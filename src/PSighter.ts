import * as puppeteer from 'puppeteer';
import * as fsExtra from 'fs-extra';
import * as fs from 'fs';
import * as request from 'request-promise';

export class PSighter {
    protected username: string;
    protected pw: string;
    protected baseCourseFolder: string;

    public static get PSHOSTNAME() : string {
        return 'https://app.pluralsight.com';
    }

    public static get PSLOGINURL() : string {
        return `${PSighter.PSHOSTNAME}/id`;
    }

    public static getCourseUrl(courseName: string) : string {
        return `${PSighter.PSHOSTNAME}/library/courses/${courseName}/table-of-contents`;
    }

    public constructor(username: string, pw: string, baseCourseFolder: string) {
        if(arguments.length < 2) {
            throw new Error('username and pw are required');
        }
        else {
            this.checkValidUsername(username);
            this.checkValidPw(pw);

            if(arguments.length > 2) {
                this.checkValidBaseCourseFolder(baseCourseFolder);
            }
            else {
                this.checkValidBaseCourseFolder('');
            }
        }
    }

    protected checkValidUsername(val: string) {
        if(val.length > 0) {
            this.username = val;
        }
        else {
            throw new Error('first parameter is not a valid username');
        }
    }

    protected checkValidPw(val: string) {
        if(val.length > 0) {
            this.pw = val;
        }
        else {
            throw new Error('second parameter is not a valid pw');
        }
    }

    protected checkValidBaseCourseFolder(val: string) {
        if(val.length > 0) {
            this.baseCourseFolder = val;
        }
        else {
            this.baseCourseFolder = './';
        }
    }

    private slugifyText(text: string) {
        return text.toLowerCase()
            .replace(/\s+/g, '-') // Replace spaces with -
            .replace(/[^\w\-]+/g, '') // Remove all non-word chars
            .replace(/\-\-+/g, '-') // Replace multiple - with single -
            .replace(/^-+/, '') // Trim - from start of text
            .replace(/-+$/, '') // Trim - from end of text
            .replace(/-/g, '_'); // Replace remaining '-' with '_'
    }

    public async downloadCourse(courseName: string, baseCourseFolder: string) {
        let loginUrl: string = PSighter.PSLOGINURL;
        let courseUrl: string = PSighter.getCourseUrl(courseName);
        let courseFolder: string = `${this.baseCourseFolder}/${courseName}`;
        if(baseCourseFolder) {
            courseFolder = `${baseCourseFolder}/${courseName}`;
        }
    
        const browser: puppeteer.Browser = await puppeteer.launch({ headless: false });
        const page: puppeteer.Page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 926 });
        await page.goto(loginUrl);
        
        const navigationPromise = page.waitForNavigation();
        
        let passwordElementArr: Element[] = [];
        do {
            // Insert Username and Password
            await page.waitForSelector('#Username');
            await page.waitForSelector('#Password');
            await page.click('#Username');
            await page.type('#Username', this.username);
            await page.click('#Password');
            await page.type('#Password', this.pw);
            await page.click('#login');
    
            // wait for 10 seconds, because PluralSight might ask the login more than once
            await page.waitFor(10000);
    
            passwordElementArr = await page.evaluate(() => {
                let pwElemArr: Element[] = Array.from(document.querySelectorAll('#Password'));
                return pwElemArr;
            });
        }
        while(passwordElementArr.length > 0);
        
        await navigationPromise;
    
        //await page.screenshot({path: `./screenshots/screenshotAfterLogin_${Date.now()}.png`});
        
        await page.goto(courseUrl);
    
        await page.waitForSelector(".drawer---2bAtz");
    
        // get drawers: let drawers = document.querySelectorAll('.drawer---2bAtz');
        // then for each drawer get the children 0 and 1
        //   drawers[i].children[0].querySelectorAll('a[class=""][target="psplayer"]'); // module
        //   drawers[i].children[1].querySelectorAll('a:not([class=""])[target="psplayer"]'); // module's lessons
        const lessonsStructure = await page.evaluate(() => {
            let innerLessonsStructure = [];
    
            let drawers: NodeListOf<Element> = document.querySelectorAll('.drawer---2bAtz');
            for (let i = 0; i < drawers.length; i++) {
                let tmpDrawer = drawers[i];
                let moduleAnchor = Array.from(tmpDrawer.children[0].querySelectorAll('a[class=""][target="psplayer"]'))[0];
                let lessonsAnchors = <HTMLAnchorElement[]>Array.from(tmpDrawer.children[1].querySelectorAll('a:not([class=""])[target="psplayer"]'));
    
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
        await lessonsStructure.forEach((val, index, theArray) => {
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
        await lessonsStructure.forEach((val, index, theArray) => {
            let tmpModuleTitle = val.moduleTitle;
            for(let i = 0; i < val.lessons.length; ++i) {
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
    
        await fsExtra.ensureDir(`${courseFolder}`);
    
        await page.screenshot({path: `${courseFolder}/screenshotCourse_${Date.now()}.png`});

        fs.writeFileSync(`${courseFolder}/courseDetails_${Date.now()}.json`, JSON.stringify(arrayForVideoDownloads, null, 2));
    
        for(let tmpLesson of arrayForVideoDownloads) {
            await this.downloadLessonVideo(page, courseFolder, tmpLesson.moduleTitle, tmpLesson.lessonTitle, tmpLesson.lessonLink);
        }
        
        await browser.close();
    }

    protected async downloadLessonVideo(page: puppeteer.Page, courseFolder: string, moduleTitle: string, lessonTitle: string, lessonLink: string) {
        // create module's folder if it does not already exist
        let moduleFolder: string = `${courseFolder}/${moduleTitle}`;
        await fsExtra.ensureDir(moduleFolder);
        
        // go to lesson link
        await page.goto(lessonLink);
        
        // wait for selector
        await page.waitForSelector("video");
    
        // wait for navigation
        await page.waitForNavigation( { waitUntil : 'domcontentloaded' } );
        
        // wait for 10 seconds
        await page.waitFor(10000);
        
        // get video src
        const videoSrc: string = await page.evaluate(() => {
            let myVideo = document.querySelector('video');
            return myVideo.getAttribute("src");
        });
        console.log(videoSrc);
    
        // download video
        let videoName: string = `${moduleFolder}/${lessonTitle}.mp4`;
        const options = {
            encoding: null,
            method: 'GET',
            uri: videoSrc,
            headers: {
                Cookie: ''
            }
        }
        
        /* add the cookies */
        const cookies: puppeteer.Cookie[] = await page.cookies();
        options.headers.Cookie = cookies.map(ck => ck.name + '=' + ck.value).join(';');
    
        // download with request and save to file system
        let videoContent: any = await request(options);
        fs.writeFileSync(videoName, videoContent);
    }
}
