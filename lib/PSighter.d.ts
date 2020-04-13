import * as puppeteer from 'puppeteer';
export declare class PSighter {
    protected username: string;
    protected pw: string;
    protected baseCourseFolder: string;
    static readonly PSHOSTNAME: string;
    static readonly PSLOGINURL: string;
    static getCourseUrl(courseName: string): string;
    constructor(username: string, pw: string, baseCourseFolder: string);
    protected checkValidUsername(val: string): void;
    protected checkValidPw(val: string): void;
    protected checkValidBaseCourseFolder(val: string): void;
    private slugifyText;
    private getRandomIntInclusive;
    downloadCourse(courseName: string, baseCourseFolder: string): Promise<void>;
    protected downloadLessonVideo(page: puppeteer.Page, courseFolder: string, moduleTitle: string, lessonTitle: string, lessonLink: string): Promise<void>;
}
