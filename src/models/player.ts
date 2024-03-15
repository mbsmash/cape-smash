import { Fighter } from "./fighter";

export interface Player {
    id: number;
    displayName: string;
    rank: number;
    mainCharacter: Fighter;
    secondaryCharacters: Fighter[];
}