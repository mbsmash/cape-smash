import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Stage } from '../../models/stage';

@Injectable({
    providedIn: 'root'
})
export class StageListService {

    // Replace these values with your stage names.
    stageNames = [
        'Battlefield',
        'Small Battlefield',
        'Town and City',
        'Smashville',
        'Pokemon Stadium 2',
        'Final Destination',
        'Hollow Bastion',
        'Kalos Pokemon League'
    ]

    stages: Stage[] = [
        { id: 1, name: this.stageNames[0], isBanned: false, imagePath: `${this.parseImagePath(this.stageNames[0])}`, isCounterpick: false },
        { id: 2, name: this.stageNames[1], isBanned: false, imagePath: `${this.parseImagePath(this.stageNames[1])}`, isCounterpick: false },
        { id: 3, name: this.stageNames[2], isBanned: false, imagePath: `${this.parseImagePath(this.stageNames[2])}`, isCounterpick: false },
        { id: 4, name: this.stageNames[3], isBanned: false, imagePath: `${this.parseImagePath(this.stageNames[3])}`, isCounterpick: false },
        { id: 5, name: this.stageNames[4], isBanned: false, imagePath: `${this.parseImagePath(this.stageNames[4])}`, isCounterpick: false },
        { id: 6, name: this.stageNames[5], isBanned: false, imagePath: `${this.parseImagePath(this.stageNames[5])}`, isCounterpick: true },
        { id: 7, name: this.stageNames[6], isBanned: false, imagePath: `${this.parseImagePath(this.stageNames[6])}`, isCounterpick: true },
        { id: 8, name: this.stageNames[7], isBanned: false, imagePath: `${this.parseImagePath(this.stageNames[7])}`, isCounterpick: true }
    ];

    constructor() {
    }

    // Implement the logic for your service methods
    getStageList(): Observable<Stage[]> {
        return new Observable<Stage[]>(observer => {
            observer.next(this.stages);
            observer.complete();
        });
    }

    parseImagePath(stageName: string): string {
        //take in a stage name, replace any spaces with dashes, and cast it to lowercase.
        const parsedStageName = stageName.replace(/ /g, '-').toLowerCase();
        return parsedStageName;
    }
}

// Export the class
export default StageListService;
