import { Injectable} from "@angular/core";
import { Fighter} from "../../models/fighter";
import { Observable,} from "rxjs";

@Injectable({
    providedIn: 'root'
})
export class FighterService {

    fighters: Fighter[] = [
        { id: 1, displayName: 'Mario', path: 'Mario', codename: 'mario', alternates: [] },
        { id: 2, displayName: 'Donkey Kong', path: 'Donkey Kong', codename: 'donkey', alternates: [] },
        { id: 3, displayName: 'Link', path: 'Link', codename: 'link', alternates: [] },
        { id: 4, displayName: 'Samus', path: 'Samus', codename: 'samus', alternates: [] },
        { id: 5, displayName: 'Dark Samus', path: 'Dark Samus', codename: 'samusd', alternates: [] },
        { id: 6, displayName: 'Yoshi', path: 'Yoshi', codename: 'yoshi', alternates: [] },
        { id: 7, displayName: 'Kirby', path: 'Kirby', codename: 'kirby', alternates: [] },
        { id: 8, displayName: 'Fox', path: 'Fox', codename: 'fox', alternates: [] },
        { id: 9, displayName: 'Pikachu', path: 'Pikachu', codename: 'pikachu', alternates: [] },
        { id: 10, displayName: 'Luigi', path: 'Luigi', codename: 'luigi', alternates: [] },
        { id: 11, displayName: 'Ness', path: 'Ness', codename: 'ness', alternates: [] },
        { id: 12, displayName: 'Captain Falcon', path: 'Captain Falcon', codename: 'captain', alternates: [] },
        { id: 13, displayName: 'Jigglypuff', path: 'Jigglypuff', codename: 'purin', alternates: [] },
        { id: 14, displayName: 'Peach', path: 'Peach', codename: 'peach', alternates: [] },
        { id: 15, displayName: 'Daisy', path: 'Daisy', codename: 'daisy', alternates: [] },
        { id: 16, displayName: 'Bowser', path: 'Bowser', codename: 'koopa', alternates: [] },
        { id: 17, displayName: 'Ice Climbers', path: 'Ice Climbers', codename: 'ice_climber', alternates: [] },
        { id: 18, displayName: 'Sheik', path: 'Sheik', codename: 'sheik', alternates: [] },
        { id: 19, displayName: 'Zelda', path: 'Zelda', codename: 'zelda', alternates: [] },
        { id: 20, displayName: 'Dr. Mario', path: 'Dr Mario', codename: 'mariod', alternates: [] },
        { id: 21, displayName: 'Pichu', path: 'Pichu', codename: 'pichu', alternates: [] },
        { id: 22, displayName: 'Falco', path: 'Falco', codename: 'falco', alternates: [] },
        { id: 23, displayName: 'Marth', path: 'Marth', codename: 'marth', alternates: [] },
        { id: 24, displayName: 'Lucina', path: 'Lucina', codename: 'lucina', alternates: [] },
        { id: 25, displayName: 'Young Link', path: 'Young Link', codename: 'younglink', alternates: [] },
        { id: 26, displayName: 'Ganondorf', path: 'Ganondorf', codename: 'ganon', alternates: [] },
        { id: 27, displayName: 'Mewtwo', path: 'Mewtwo', codename: 'mewtwo', alternates: [] },
        { id: 28, displayName: 'Roy', path: 'Roy', codename: 'roy', alternates: [] },
        { id: 29, displayName: 'Chrom', path: 'Chrom', codename: 'chrom', alternates: [] },
        { id: 30, displayName: 'Mr. Game & Watch', path: 'Mr Game & Watch', codename: 'gamewatch', alternates: [] },
        { id: 31, displayName: 'Meta Knight', path: 'Meta Knight', codename: 'metaknight', alternates: [] },
        { id: 32, displayName: 'Pit', path: 'Pit', codename: 'pit', alternates: [] },
        { id: 33, displayName: 'Dark Pit', path: 'Dark Pit', codename: 'pitb', alternates: [] },
        { id: 34, displayName: 'Zero Suit Samus', path: 'Zero Suit Samus', codename: 'szerosuit', alternates: [] },
        { id: 35, displayName: 'Wario', path: 'Wario', codename: 'wario', alternates: [] },
        { id: 36, displayName: 'Snake', path: 'Snake', codename: 'snake', alternates: [] },
        { id: 37, displayName: 'Ike', path: 'Ike', codename: 'ike', alternates: [] },
        { id: 38, displayName: 'Pokémon Trainer', path: 'Pokemon Trainer', codename: 'ptrainer', alternates: [] },
        { id: 39, displayName: 'Diddy Kong', path: 'Diddy Kong', codename: 'diddy', alternates: [] },
        { id: 40, displayName: 'Lucas', path: 'Lucas', codename: 'lucas', alternates: [] },
        { id: 41, displayName: 'Sonic', path: 'Sonic', codename: 'sonic', alternates: [] },
        { id: 42, displayName: 'King Dedede', path: 'King Dedede', codename: 'dedede', alternates: [] },
        { id: 43, displayName: 'Olimar', path: 'Olimar (Alph)', codename: 'pikmin', alternates: [] },
        { id: 44, displayName: 'Lucario', path: 'Lucario', codename: 'lucario', alternates: [] },
        { id: 45, displayName: 'R.O.B.', path: 'ROB', codename: 'robot', alternates: [] },
        { id: 46, displayName: 'Toon Link', path: 'Toon Link', codename: 'toonlink', alternates: [] },
        { id: 47, displayName: 'Wolf', path: 'Wolf', codename: 'wolf', alternates: [] },
        { id: 48, displayName: 'Villager', path: 'Villager', codename: 'murabito', alternates: [] },
        { id: 49, displayName: 'Mega Man', path: 'Megaman', codename: 'rockman', alternates: [] },
        { id: 50, displayName: 'Wii Fit Trainer', path: 'Wii Fit Trainer', codename: 'wiifit', alternates: [] },
        { id: 51, displayName: 'Rosalina & Luma', path: 'Rosalina and Luma', codename: 'rosetta', alternates: [] },
        { id: 52, displayName: 'Little Mac', path: 'Littlemac', codename: 'littlemac', alternates: [] },
        { id: 53, displayName: 'Greninja', path: 'Greninja', codename: 'gekkouga', alternates: [] },
        { id: 54, displayName: 'Mii Brawler', path: 'Mii', codename: 'miifighter', alternates: [] },
        { id: 55, displayName: 'Mii Swordfighter', path: 'Mii', codename: 'miiswordsman', alternates: [] },
        { id: 56, displayName: 'Mii Gunner', path: 'Mii', codename: 'miigunner', alternates: [] },
        { id: 57, displayName: 'Palutena', path: 'Palutena', codename: 'palutena', alternates: [] },
        { id: 58, displayName: 'Pac-Man', path: 'Pac-Man', codename: 'pacman', alternates: [] },
        { id: 59, displayName: 'Robin', path: 'Robin', codename: 'reflet', alternates: [] },
        { id: 60, displayName: 'Shulk', path: 'Shulk', codename: 'shulk', alternates: [] },
        { id: 61, displayName: 'Bowser Jr.', path: 'Bowserjr', codename: 'koopajr', alternates: [] },
        { id: 62, displayName: 'Duck Hunt', path: 'Duckhunt', codename: 'duckhunt', alternates: [] },
        { id: 63, displayName: 'Ryu', path: 'Ryu', codename: 'ryu', alternates: [] },
        { id: 64, displayName: 'Ken', path: 'Ken', codename: 'ken', alternates: [] },
        { id: 65, displayName: 'Cloud', path: 'Cloud', codename: 'cloud', alternates: [] },
        { id: 66, displayName: 'Corrin', path: 'Corrin', codename: 'kamui', alternates: [] },
        { id: 67, displayName: 'Bayonetta', path: 'Bayonetta', codename: 'bayonetta', alternates: [] },
        { id: 68, displayName: 'Inkling', path: 'Inkling', codename: 'inkling', alternates: [] },
        { id: 69, displayName: 'Ridley', path: 'Ridley', codename: 'ridley', alternates: [] },
        { id: 70, displayName: 'Simon', path: 'Simon', codename: 'simon', alternates: [] },
        { id: 71, displayName: 'Richter', path: 'Richter', codename: 'richter', alternates: [] },
        { id: 72, displayName: 'King K. Rool', path: 'Kingkrool', codename: 'krool', alternates: [] },
        { id: 73, displayName: 'Isabelle', path: 'Isabelle', codename: 'shizue', alternates: [] },
        { id: 74, displayName: 'Incineroar', path: 'Incineroar', codename: 'gaogaen', alternates: [] },
        { id: 75, displayName: 'Piranha Plant', path: 'Piranha Plant', codename: 'packun', alternates: [] },
        { id: 76, displayName: 'Joker', path: 'Joker', codename: 'jack', alternates: [] },
        { id: 77, displayName: 'Hero', path: 'Hero', codename: 'brave', alternates: [] },
        { id: 78, displayName: 'Banjo & Kazooie', path: 'Banjo and Kazooie', codename: 'buddy', alternates: [] },
        { id: 79, displayName: 'Terry', path: 'Terry Bogard', codename: 'dolly', alternates: [] },
        { id: 80, displayName: 'Byleth', path: 'Byleth', codename: 'master', alternates: [] },
        { id: 81, displayName: 'Min Min', path: 'Min Min', codename: 'tantan', alternates: [] },
        { id: 82, displayName: 'Steve', path: 'Steve', codename: 'pickel', alternates: [] },
        { id: 83, displayName: 'Sephiroth', path: 'Sephiroth', codename: 'edge', alternates: [] },
        { id: 84, displayName: 'Pyra/Mythra', path: 'Pyra and Mythra', codename: 'elight', alternates: [] },
        { id: 85, displayName: 'Kazuya', path: 'Kazuya', codename: 'demon', alternates: [] },
        { id: 86, displayName: 'Sora', path: 'Sora', codename: 'trail', alternates: [] },
    ]

    getAllFighters(): Observable<Fighter[]> {
        return new Observable<Fighter[]>(observer => {
            observer.next(this.fighters);
            observer.complete();
        });
    }

    getFighterGroup(fighters: string[]): Fighter[] {
        return this.fighters;
    }

    getFighterByDisplayName(displayName: string): Fighter {
        let fighter = this.fighters.find(fighter => fighter.displayName === displayName);
        if (!fighter) {
            throw new Error(`No fighter found with displayName: ${displayName}`);
        }
        return fighter;
    }

    getMainCharacterImage(fighter: Fighter): string {
        return "/assets/images/fighter-portraits/" + fighter.displayName + "/chara_1_" + fighter.codename + "_00.jpg";
    }

    getSecondaryCharacterImage(fighter: Fighter): string {
        return "/assets/images/fighter-portraits/" + fighter.displayName + "/chara_3_" + fighter.codename + "_00.jpg";
    }

}