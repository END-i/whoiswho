// Дизайни картки питання (власник 23.11): K — за замовчуванням, решта — на вибір у налаштуваннях.
// Логіка картки одна; дизайн — лише клас і стилі в QuestionCard.svelte.
export const DESIGNS = ['k', 'g', 'h', 'j', 'e', 'f'];
export const DEFAULT_DESIGN = 'k';

/** Збережене значення → відомий дизайн (стара чи пошкоджена назва — дизайн за замовчуванням). */
export const cleanDesign = (d) => (DESIGNS.includes(d) ? d : DEFAULT_DESIGN);
