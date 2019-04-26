# PSighter

**_PSighter_** is a Node library written with the purpose of downloading Pluralsight courses.

It is written in _Typescript_, and uses the power of [puppeteer](https://www.npmjs.com/package/puppeteer) to scrape the [Pluralsight](https://app.pluralsight.com) portal.

Have a look at the author's portfolio [Danilo Carrabino](http://myportfolio.danilocarrabino.net/portfolios/danilo.carrabino)

***

## How to compile

> _npm run build_


## Example usage
```js
const {PSighter} = require('psighter');

/// PARAMETERS /////////////////////////////////////////////////////////////////////
let username = '<username>'; // Pluralsight username
let pw = '<password>'; // Pluralsight password

// List of courses to download
// The course name has to be:
//   https://app.pluralsight.com/library/courses/<courseName>/table-of-contents
// The baseCourseFolder has to be any writable local machine folder
let courses = [
    {
        courseName: '<courseName1>',
        baseCourseFolder: './topic1'
    },
    {
        courseName: '<courseName2>',
        baseCourseFolder: './topic2'
    }
];
////////////////////////////////////////////////////////////////////////////////////

(async () => {
    // PSighter instance
    const pSighter = new PSighter(username, pw);

    // download courses
    for(let i = 0; i < courses.length; ++i) {
        let course = courses[i];
        await pSighter.downloadCourse(course.courseName, course.baseCourseFolder);
    }
})();
```
