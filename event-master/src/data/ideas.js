// Explore-mode inspiration. Ideas can be saved without creating an event.
export const IDEA_GROUPS = [
  {
    id: 'themes',
    title: 'Themes',
    ideas: [
      { id: 'idea-galaxy', emoji: '🌌', title: 'Galaxy Glow Night', text: 'Deep purples, star garlands, glow sticks and a cosmic playlist.' },
      { id: 'idea-pastel-picnic', emoji: '🧺', title: 'Pastel Picnic', text: 'Blankets, bunting, fruit cups and a relaxed garden feel.' },
      { id: 'idea-neon-disco', emoji: '🪩', title: 'Neon Disco', text: 'Mirror ball, neon sign, chrome balloons and a dance-off.' },
      { id: 'idea-hollywood', emoji: '🎬', title: 'Hollywood Glam', text: 'Gold and black, a red-carpet entrance and photo props.' },
      { id: 'idea-garden-tea', emoji: '🫖', title: 'Garden Tea Party', text: 'Florals, macarons, lanterns and soft music.' },
    ],
  },
  {
    id: 'activities',
    title: 'Activities',
    ideas: [
      { id: 'idea-karaoke', emoji: '🎤', title: 'Karaoke Battle', text: 'Teams pick songs; guests vote for the winner.' },
      { id: 'idea-bracelets', emoji: '📿', title: 'Bracelet Bar', text: 'Everyone makes a bracelet to take home.' },
      { id: 'idea-cookies', emoji: '🍪', title: 'Cookie Decorating', text: 'Icing, sprinkles and a mini judging panel.' },
      { id: 'idea-movie', emoji: '🍿', title: 'Outdoor Movie', text: 'Projector, beanbags and a popcorn bar.' },
    ],
  },
  {
    id: 'decor',
    title: 'Decorations',
    ideas: [
      { id: 'idea-arch', emoji: '🎈', title: 'Purple Balloon Arch', text: 'An organic arch framing the cake table.' },
      { id: 'idea-canopy', emoji: '✨', title: 'Fairy-Light Canopy', text: 'Warm lights strung overhead for evening glow.' },
      { id: 'idea-tablescape', emoji: '🍽️', title: 'Styled Tablescape', text: 'Layered runner, gold-rim plates and confetti.' },
    ],
  },
  {
    id: 'food',
    title: 'Food & cake',
    ideas: [
      { id: 'idea-drip-cake', emoji: '🎂', title: 'Chocolate Drip Cake', text: 'A showstopper that photographs beautifully.' },
      { id: 'idea-grazing', emoji: '🧀', title: 'Grazing Table', text: 'Let guests graze all party long.' },
      { id: 'idea-mocktails', emoji: '🥂', title: 'Mocktail Bar', text: 'Sparkling juices with fun garnishes.' },
    ],
  },
];

export const ALL_IDEAS = IDEA_GROUPS.flatMap((g) => g.ideas.map((i) => ({ ...i, group: g.title })));

export function getIdea(id) {
  return ALL_IDEAS.find((i) => i.id === id) || null;
}

// Short examples for "See what Event Master can plan".
export const CATEGORY_EXAMPLES = {
  decorations: ['Balloons sized to your guest list', 'A banner that matches your colours', 'Table settings and a photo backdrop'],
  food: ['Mains, snacks and drinks', 'Quantities worked out from your guest count', 'Options for every budget'],
  cake: ['Cake or cupcakes', 'Candles and toppers to match', 'Styles from cute to glam'],
  activities: ['A headline activity', 'Games for your age group', 'Ideas that fit your vibe'],
  invitations: ['Digital or printed', 'Designs that set the tone', 'Enough for every guest'],
  favours: ['Party bags', 'Fillers everyone will love', 'One per guest, automatically'],
  music: ['Sound for your venue', 'A playlist for your vibe', 'Or a DJ for bigger parties'],
  photography: ['Photo props', 'Instant or disposable cameras', 'Or a photographer'],
  extras: ['Lighting that changes the mood', 'A wow moment', 'Little touches guests remember'],
};
