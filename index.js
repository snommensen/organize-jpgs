const walk = require('walk')
const fs = require('fs-extra')
const path = require("path")
const ExifImage = require('exif').ExifImage
const moment = require('moment')
const program = require('commander')

program
    .version('1.0.0')
    .usage('<source> <target>')
    .option('-s, --source <src-dir>', 'Source dir for your JPG images')
    .option('-t, --target <target-dir>', 'Target dir for your JPG images')
    .parse(process.argv)

if (!program.source) {
    console.error('no source given!')
    program.help()
    process.exit(1)
}

if (!program.target) {
    console.error('no target given!')
    program.help()
    process.exit(1)
}

const source = program.source
const target = program.target

const parseDate = (date) => {
    const dateFormat = 'YYYY:MM:DD HH:mm:ss'
    if (date == null || !moment(date, dateFormat).isValid()) {
        return null
    }
    return moment(date, dateFormat)
}

const isJpeg = (fileName) => fileName != null && (fileName.endsWith('.jpg') || fileName.endsWith('.JPG') || fileName.endsWith('.jpeg'))

const readExif = (root, fileName, callback) => {
    let fullPath = path.join(root, fileName)

    if (!isJpeg(fileName)) {
        callback({
            message: `No JPG file! => ${fileName}`
        })
    }

    const handleExifData = (error, exifData) => {
        if (error) {
            callback(error)
        } else {
            callback(null, {
                name: fileName,
                created: exifData.exif.CreateDate,
                modified: exifData.image.ModifyDate
            })
        }
    }

    new ExifImage({
        image: fullPath
    }, handleExifData)
}

const pad = (number) => {
    if (number < 10) {
        return `0${number}`
    } else {
        return `${number}`
    }
}

const chooseDate = (imageData) => {
    if (parseDate(imageData.created) !== null) {
        return parseDate(imageData.created)
    } else if (parseDate(imageData.modified) !== null) {
        return parseDate(imageData.modified)
    } else {
        return moment("19990101", "YYYYMMDD")
    }
}

function makeTargetDir(imageData) {
    const date = chooseDate(imageData)
    const month = pad(date.month() + 1)
    const year = pad(date.year())
    const day = pad(date.date())
    return `${target}/${year}/${year}-${month}-${day}`
}

function copyJpgs(targetDir, name, next, root, fileStats) {
    const targetPath = `${targetDir}/${name}`

    if (fs.existsSync(targetPath)) {
        next()
    } else {
        fs.copy(`${path.join(root, fileStats.name)}`, targetPath)
            .then(() => {
                console.log(`copied ${name} to ${targetDir}/${name}`)
                next()
            })
            .catch(err => {
                console.error(`${fileStats.name}: ${err}`)
                next()
            })
    }
}

const walker = walk.walk(source, {
    followLinks: false
})

walker.on("file", (root, fileStats, next) => {
    readExif(root, fileStats.name, (error, imageData) => {
        if (error) {
            console.error(error.message)
            next()
        } else {
            const name = imageData.name
            const targetDir = makeTargetDir(imageData)
            fs.mkdirp(targetDir, (err) => {
                if (err) {
                    console.error(err)
                    next()
                } else {
                    copyJpgs(targetDir, name, next, root, fileStats);
                }
            })
        }
    })
})

walker.on("errors", (root, nodeStatsArray, next) => {
    next()
})

walker.on("end", () => {
    console.log("Done.")
})