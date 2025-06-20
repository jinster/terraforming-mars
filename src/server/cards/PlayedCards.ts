import {CardName} from '../../common/cards/CardName';
import {IProjectCard} from './IProjectCard';
import {inplaceRemove} from '../../common/utils/utils';
import {deserializeProjectCard, serializeProjectCard} from './cardSerialization';
import {SerializedCard} from '../SerializedCard';
import {ICard} from './ICard';
import {CardType} from '../../common/cards/CardType';
import {Tag} from '../../common/cards/Tag';

const NO_TAGS = {
  [Tag.BUILDING]: 0,
  [Tag.SPACE]: 0,
  [Tag.SCIENCE]: 0,
  [Tag.POWER]: 0,
  [Tag.EARTH]: 0,
  [Tag.JOVIAN]: 0,
  [Tag.VENUS]: 0,
  [Tag.PLANT]: 0,
  [Tag.MICROBE]: 0,
  [Tag.ANIMAL]: 0,
  [Tag.CITY]: 0,
  [Tag.MOON]: 0,
  [Tag.MARS]: 0,
  [Tag.CRIME]: 0,
  [Tag.WILD]: 0,
  [Tag.EVENT]: 0,
  [Tag.CLONE]: 0,
} as const;

/**
 * Represents all cards in front of a player EXCEPT Corporation Cards.
 *
 * As an implementation, it optimizes on a few common lookup mechanisms
 * so as to replace O(n) lookups with O(1) lookups like "Is this card in
 * play?"
 *
 * It can also extend to filters such as "What are the events in play?",
 * which is constantly checked. Imagine also if the same coud apply
 * to "How mant tags are in play?"
 *
 * Cards are retained in insertion order.
 */
export class PlayedCards {
  private array: Array<IProjectCard> = [];
  private byName: Map<CardName, IProjectCard> = new Map();
  private _eventCount: number = 0;
  private _tags: Record<Tag, number> = {...NO_TAGS};

  /**
   * Return the number of played cards.
   */
  public get length(): number {
    return this.array.length;
  }

  /**
   * Get the card by the given name, or `undefined` if it is not here.
   */
  public get(name: CardName): IProjectCard | undefined {
    return this.byName.get(name);
  }

  /**
   * Return the set of played cards as an array, in the order they are played.
   */
  public asArray(): ReadonlyArray<IProjectCard> {
    return this.array;
  }

  /**
   * Shortcut for returning the most recently played card, or `undefined` if this set is empty.
   */
  public last(): IProjectCard | undefined {
    return this.array[this.array.length - 1];
  }

  /**
   * Returns an iterator over the set of played cards in insertion order.
   */
  [Symbol.iterator](): Iterator<IProjectCard> {
    return this.array[Symbol.iterator]();
  }

  public get eventCount() {
    return this._eventCount;
  }

  public get tags(): Readonly<Record<Tag, number>> {
    return this._tags;
  }
  /**
   * Returns the elements of an array that meet the condition specified in a callback function.
   * @param predicate A function that accepts up to three arguments. The filter method calls the predicate function one time for each element in the array.
   * @param thisArg An object to which the this keyword can refer in the predicate function. If thisArg is omitted, undefined is used as the this value.
   */
  filter(predicate: (value: IProjectCard, index: number, array: ReadonlyArray<IProjectCard>) => unknown, thisArg?: any): Array<IProjectCard> {
    return this.array.filter(predicate, thisArg);
  }

  /**
   * Determines whether the specified callback function returns true for any element of an array.
   * @param predicate A function that accepts up to three arguments. The some method calls
   * the predicate function for each element in the array until the predicate returns a value
   * which is coercible to the Boolean value true, or until the end of the array.
   * @param thisArg An object to which the this keyword can refer in the predicate function.
   * If thisArg is omitted, undefined is used as the this value.
   */
  some(predicate: (value: IProjectCard, index: number, array: Array<IProjectCard>) => unknown, thisArg?: any): boolean {
    return this.array.some(predicate, thisArg);
  }

  /**
   * Add `cards` in order.
   */
  public push(...cards: Array<IProjectCard>) {
    for (const card of cards) {
      if (this.get(card.name)) {
        throw new Error(`${card.name} already exists`);
      }
      this.pushCard(card);
    }
  }

  private pushCard(card: IProjectCard) {
    this.array.push(card);
    this.byName.set(card.name, card);
    if (card.type === CardType.EVENT) {
      this._eventCount++;
    } else {
      this.addTags(card);
    }
  }

  /**
   * Remove card from play. Updates indexes. It is up to the caller
   * to put the card wherever it eventually belongs.
   */
  remove(card: ICard) {
    const found = this.byName.delete(card.name);
    if (found) {
      inplaceRemove(this.array, card);
      if (card.type === CardType.EVENT) {
        this._eventCount--;
      } else {
        this.removeTags(card);
      }
    }
    return found;
  }

  /**
   * Remove all the cards and replace them with those supplied in `cards`
   */
  public set(...cards: Array<IProjectCard>) {
    this.byName.clear();
    this.array = [];
    this._eventCount = 0;
    this._tags = {...NO_TAGS};

    this.push(...cards);
  }

  private addTags(card: ICard) {
    for (const tag of card.tags) {
      this._tags[tag]++;
    }
  }

  private removeTags(card: ICard) {
    for (const tag of card.tags) {
      this._tags[tag]--;
    }
  }

  /**
   * Some cards have dynamic behavior: clone tags, or the Xavier
   * CEO. This object caches all the tags of played cards. So,
   * when a card's tags are changed after being placed here, this
   * allows the card to update its state.
   */
  public retagCard(card: ICard, cb: () => void) {
    this.removeTags(card);
    cb();
    this.addTags(card);
  }

  public serialize(): Array<SerializedCard> {
    return this.array.map(serializeProjectCard);
  }

  public static deserialize(serialized: SerializedCard[]): PlayedCards {
    const playedCards = new PlayedCards();
    const cards = serialized.map((element) => deserializeProjectCard(element));
    for (const card of cards) {
      playedCards.push(card);
    }
    return playedCards;
  }
}
