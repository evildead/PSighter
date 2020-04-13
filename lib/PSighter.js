"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const fsExtra = require("fs-extra");
const puppeteer = require("puppeteer");
const request = require("request-promise");
class PSighter {
    constructor(username, pw, baseCourseFolder) {
        if (arguments.length < 2) {
            throw new Error('username and pw are required');
        }
        else {
            this.checkValidUsername(username);
            this.checkValidPw(pw);
            if (arguments.length > 2) {
                this.checkValidBaseCourseFolder(baseCourseFolder);
            }
            else {
                this.checkValidBaseCourseFolder('');
            }
        }
    }
    static get PSHOSTNAME() {
        return 'https://app.pluralsight.com';
    }
    static get PSLOGINURL() {
        return `${PSighter.PSHOSTNAME}/id`;
    }
    static getCourseUrl(courseName) {
        return `${PSighter.PSHOSTNAME}/library/courses/${courseName}/table-of-contents`;
    }
    checkValidUsername(val) {
        if (val.length > 0) {
            this.username = val;
        }
        else {
            throw new Error('first parameter is not a valid username');
        }
    }
    checkValidPw(val) {
        if (val.length > 0) {
            this.pw = val;
        }
        else {
            throw new Error('second parameter is not a valid pw');
        }
    }
    checkValidBaseCourseFolder(val) {
        if (val.length > 0) {
            this.baseCourseFolder = val;
        }
        else {
            this.baseCourseFolder = './';
        }
    }
    slugifyText(text) {
        return text.toLowerCase()
            .replace(/\s+/g, '-') // Replace spaces with -
            .replace(/[^\w\-]+/g, '') // Remove all non-word chars
            .replace(/\-\-+/g, '-') // Replace multiple - with single -
            .replace(/^-+/, '') // Trim - from start of text
            .replace(/-+$/, '') // Trim - from end of text
            .replace(/-/g, '_'); // Replace remaining '-' with '_'
    }
    getRandomIntInclusive(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1)) + min; //The maximum is inclusive and the minimum is inclusive
    }
    downloadCourse(courseName, baseCourseFolder) {
        return __awaiter(this, void 0, void 0, function* () {
            let loginUrl = PSighter.PSLOGINURL;
            let courseUrl = PSighter.getCourseUrl(courseName);
            let courseFolder = `${this.baseCourseFolder}/${courseName}`;
            if (baseCourseFolder) {
                courseFolder = `${baseCourseFolder}/${courseName}`;
            }
            const browser = yield puppeteer.launch({ headless: false });
            const page = yield browser.newPage();
            yield page.setViewport({ width: 1920, height: 926 });
            yield page.goto(loginUrl);
            const navigationPromise = page.waitForNavigation();
            let passwordElementArr = [];
            do {
                // Insert Username and Password
                yield page.waitForSelector('#Username');
                yield page.waitForSelector('#Password');
                yield page.click('#Username');
                yield page.type('#Username', this.username);
                yield page.click('#Password');
                yield page.type('#Password', this.pw);
                yield page.click('#login');
                // wait for 10 seconds, because PluralSight might ask the login more than once
                yield page.waitFor(10000);
                passwordElementArr = yield page.evaluate(() => {
                    let pwElemArr = Array.from(document.querySelectorAll('#Password'));
                    return pwElemArr;
                });
            } while (passwordElementArr.length > 0);
            yield navigationPromise;
            //await page.screenshot({path: `./screenshots/screenshotAfterLogin_${Date.now()}.png`});
            yield page.goto(courseUrl);
            yield page.waitForSelector(".drawer---2bAtz");
            // get drawers: let drawers = document.querySelectorAll('.drawer---2bAtz');
            // then for each drawer get the children 0 and 1
            //   drawers[i].children[0].querySelectorAll('a[class=""][target="psplayer"]'); // module
            //   drawers[i].children[1].querySelectorAll('a:not([class=""])[target="psplayer"]'); // module's lessons
            const lessonsStructure = yield page.evaluate(() => {
                let innerLessonsStructure = [];
                let drawers = document.querySelectorAll('.drawer---2bAtz');
                for (let i = 0; i < drawers.length; i++) {
                    let tmpDrawer = drawers[i];
                    let moduleAnchor = Array.from(tmpDrawer.children[0].querySelectorAll('a[class=""][target="psplayer"]'))[0];
                    let lessonsAnchors = Array.from(tmpDrawer.children[1].querySelectorAll('a:not([class=""])[target="psplayer"]'));
                    let moduleLessonsStructure = {
                        moduleTitle: moduleAnchor.textContent,
                        lessons: lessonsAnchors.map(lessonAnchor => {
                            return {
                                lessonTitle: lessonAnchor.textContent,
                                lessonLink: lessonAnchor.href
                            };
                        })
                    };
                    innerLessonsStructure.push(moduleLessonsStructure);
                }
                return innerLessonsStructure;
            });
            // slugify titles
            yield lessonsStructure.forEach((val, index, theArray) => {
                let newLessonsArr = val.lessons.map((lesson, lessonIndex) => {
                    return {
                        lessonTitle: lessonIndex + '_' + this.slugifyText(lesson.lessonTitle),
                        lessonLink: lesson.lessonLink
                    };
                });
                let slugifiedModuleTitle = index + '_' + this.slugifyText(val.moduleTitle);
                let newModuleLessonsStructure = {
                    moduleTitle: slugifiedModuleTitle,
                    lessons: newLessonsArr
                };
                theArray[index] = newModuleLessonsStructure;
            });
            let arrayForVideoDownloads = [];
            yield lessonsStructure.forEach((val, index, theArray) => {
                let tmpModuleTitle = val.moduleTitle;
                for (let i = 0; i < val.lessons.length; ++i) {
                    let lesson = val.lessons[i];
                    arrayForVideoDownloads.push({
                        moduleTitle: tmpModuleTitle,
                        lessonTitle: lesson.lessonTitle,
                        lessonLink: lesson.lessonLink
                    });
                }
            });
            //console.log(JSON.stringify(lessonsStructure));
            //console.log(arrayForVideoDownloads);
            yield fsExtra.ensureDir(`${courseFolder}`);
            yield page.screenshot({ path: `${courseFolder}/screenshotCourse_${Date.now()}.png` });
            fs.writeFileSync(`${courseFolder}/courseDetails_${Date.now()}.json`, JSON.stringify(arrayForVideoDownloads, null, 2));
            for (let tmpLesson of arrayForVideoDownloads) {
                yield this.downloadLessonVideo(page, courseFolder, tmpLesson.moduleTitle, tmpLesson.lessonTitle, tmpLesson.lessonLink);
            }
            yield browser.close();
        });
    }
    downloadLessonVideo(page, courseFolder, moduleTitle, lessonTitle, lessonLink) {
        return __awaiter(this, void 0, void 0, function* () {
            // create module's folder if it does not already exist
            let moduleFolder = `${courseFolder}/${moduleTitle}`;
            yield fsExtra.ensureDir(moduleFolder);
            try {
                yield fsExtra.access(`${moduleFolder}/${lessonTitle}.mp4`);
                console.log("File already exists, moving to next file");
            }
            catch (error) {
                // go to lesson link
                yield page.goto(lessonLink);
                // wait for selector
                yield page.waitForSelector("video");
                // wait for navigation
                // await page.waitForNavigation( { waitUntil : 'domcontentloaded' } );
                // wait for 15 seconds
                yield page.waitFor(15000);
                // get video src
                const videoSrc = yield page.evaluate(() => {
                    let myVideo = document.querySelector('video');
                    return myVideo.getAttribute("src");
                });
                console.log(videoSrc);
                // download video
                let videoName = `${moduleFolder}/${lessonTitle}.mp4`;
                const options = {
                    encoding: null,
                    method: 'GET',
                    uri: videoSrc,
                    headers: {
                        Cookie: ''
                    }
                };
                /* add the cookies */
                const cookies = yield page.cookies();
                options.headers.Cookie = cookies.map(ck => ck.name + '=' + ck.value).join(';');
                // download with request and save to file system
                let videoContent = yield request(options);
                fs.writeFileSync(videoName, videoContent);
                let t = this.getRandomIntInclusive(30 * 1000, 120 * 1000);
                console.log('Waiting for :' + t / 1000 + ' seconds');
                yield page.waitFor(t);
            }
        });
    }
}
exports.PSighter = PSighter;
//# sourceMappingURL=PSighter.js.map