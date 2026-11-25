import { parseArt, type Grid } from './pixels';

/** A generic pixel visitor for the chat. It stands for "you", never for a real identity. */
export const VISITOR: Grid = parseArt([
  '...oooooo...',
  '..ohhhhhho..',
  '.ohhhhhhhho.',
  '.ohsssssho..',
  '.osesssesos.',
  '.osssssssso.',
  '..ossmmsso..',
  '...osssso...',
  '..occcccco..',
  '.occcccccco.',
  'occcccccccco',
  'occcccccccco',
], { o: 'av-line', h: 'av-hair', s: 'av-skin', e: 'av-eye', m: 'av-mouth', c: 'av-shirt' });
