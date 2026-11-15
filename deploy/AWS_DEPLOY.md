# Put Sol Survivors online at nasa.samuelojo.tech

Your static site `samuelojo.tech` is not touched. The game gets its own address, `nasa.samuelojo.tech`, pointing at your t4g.micro.

How it fits together: a player's browser goes to `https://nasa.samuelojo.tech`. nginx on the server handles HTTPS and passes the traffic to the game (Node, port 3000). The game now has **rooms**: "Create a game" gives a 4-letter code, friends type it (or open the shared link `?room=CODE`) to join. Up to 3 players per game, up to 40 games at once (change `MAX_ROOMS` in the service file).

## 1. Start the server (AWS console, EC2)
- Launch (or use your existing) **t4g.micro**, **Amazon Linux 2023 (arm64)**, 8 GB disk.
- Give it an **Elastic IP** (EC2 > Elastic IPs > Allocate, then Associate). Otherwise the address changes whenever it restarts.
- **Security group** inbound rules: SSH 22 (My IP only), HTTP 80 (anywhere), HTTPS 443 (anywhere). Do **not** open port 3000.

## 2. DNS: point nasa.samuelojo.tech at it
Where is the DNS for samuelojo.tech? Most likely Route 53.
- Route 53 > Hosted zones > samuelojo.tech > Create record: name `nasa`, type **A**, value = your Elastic IP, TTL 300.
- If the domain's DNS is somewhere else (e.g. the registrar), add the same A record there.
- Check from your computer: `dig +short nasa.samuelojo.tech` shows the IP. (Wait a few minutes if not.)

## 3. One-time server setup
(If the server already runs other sites, e.g. nginx + certbot for another subdomain, this script leaves them alone: it only adds Node, a swap file and a `sol` user. The game uses its own port 3000 and its own nginx file `nasa.conf`.)
From the game folder on your computer (use your key file):
```
scp -i ~/key.pem deploy/setup-server.sh ec2-user@nasa.samuelojo.tech:/tmp/
ssh -i ~/key.pem ec2-user@nasa.samuelojo.tech 'sudo bash /tmp/setup-server.sh'
```
This installs Node 22, rsync, a swap file (if there is none) and a `sol` user.

## 4. Copy the game (repeat this step for every update)
```
bash deploy/deploy.sh ec2-user@nasa.samuelojo.tech ~/key.pem
```

## 5. Turn it on (once)
```
ssh -i ~/key.pem ec2-user@nasa.samuelojo.tech 'sudo bash /opt/sol-survivors/deploy/install-service.sh'
```
Now `http://nasa.samuelojo.tech` should show the game.

## 6. HTTPS (free certificate)
```
ssh -i ~/key.pem ec2-user@nasa.samuelojo.tech 'sudo certbot --nginx -d nasa.samuelojo.tech --agree-tos -m YOU@EMAIL --redirect'
```
Certbot renews itself with a timer; check with `sudo certbot renew --dry-run`. If `certbot.timer` is missing: `sudo systemctl enable --now certbot-renew.timer` or add a cron line `0 3 * * * certbot renew -q`.

## 7. Try it
Open `https://nasa.samuelojo.tech` on two devices: Create a game on one, join with the code on the other.

## Handy commands (on the server)
- Logs: `sudo journalctl -u sol-survivors -f`
- Restart: `sudo systemctl restart sol-survivors`
- Health: `curl http://127.0.0.1:3000/healthz` (shows open games and connections)

## Notes
- A game that everyone has left closes after 1 minute. Games are kept in memory, so a server restart ends games in progress (players return to the lobby page).
- 1 GB RAM is plenty for several games: the server only relays messages; each player's browser runs the game.
- The t4g.micro's CPU credits are fine for this, but watch CloudWatch if you get a big crowd.
- Cost: the instance and Elastic IP (free while attached to a running instance); Route 53 adds about $0.50 per month for the zone you already have.
- Optional later: restrict SSH to your IP, enable automatic OS updates (`sudo dnf install dnf-automatic`).
