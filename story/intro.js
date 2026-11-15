// The opening crawl: the first thing players see when a game starts with the story on (before launch day).
// Yellow words that slide up and away into space, tilted back. Drawn in HTML: see game/client/js/crawl.js.
//
// 👤 Owner: Story & NASA data.  Change the words freely.
// title: the big first line   paragraphs: one string each (WORDS IN CAPITALS stand out)
// seconds: how long the crawl takes. Kids read slowly: keep it long enough (about 1 second per 2 words).

export const INTRO = {
  title: 'THE YEAR IS 2041.',
  paragraphs: [
    'In a world much like our own, humans have finally cracked the secret of reaching MARS.',
    'Three astronauts blast off aboard the Perseverance VI: a Botanist, a Builder and a Pilot, the best NASA has ever trained.',
    'But just days from Mars, disaster strikes. A storm of SPACE DEBRIS tears through the ship and sets it on fire.',
    'With seconds to spare, the crew escapes in the lander and CRASH-LANDS on the red planet, not far from Jezero Base, an outpost built in 2028 and abandoned ever since.',
    'The air is running out. The machines are broken. Earth is millions of kilometres away.',
    'To survive, they must work as ONE CREW, and find a way HOME.',
  ],
  seconds: 60,
  skip: 'Space: skip',                         // shown to the host (and in a solo game)
  skipOther: 'The host can skip',              // shown to everyone else
};
