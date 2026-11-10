/**
 * Grammar for people's names in results. A person can be called "You", and
 * "You retires" or "You's super" reads badly, so these pick the right words.
 */

/** True when the name is the reader themselves ("You", any case). */
export const isYou = (name: string) => name.trim().toLowerCase() === "you";

/** "your" (or "Your" at the start of a sentence), else "Sam's". */
export const possessive = (name: string, start = false) =>
  isYou(name) ? (start ? "Your" : "your") : `${name}'s`;

/** The name mid-sentence, as the object: "saves you", "saves Sam". */
export const objectName = (name: string) => (isYou(name) ? "you" : name);

/** The verb that agrees with the name: verb("You", "retires", "retire") is "retire". */
export const verb = (name: string, third: string, plain: string) => (isYou(name) ? plain : third);
