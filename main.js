const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const {Storage} = require('@google-cloud/storage');
const storage = new Storage();
const bucket = storage.bucket('');

const fs = require('fs');
const path = require('path');
const os = require('os');
const request = require('request');
const validUrl = require('valid-url');

// firebase deploy --only functions
exports.saveToStorage = functions.database.ref('/users/{uid}/bucket/{pushId}').onWrite(async (change, context) => {
    // Exit when the data is deleted.
    if (!change.after.exists()) {
        let beforeKey = change.before.key;
        let userId = context.params.uid;
        let formats = ['.gif', '.mp4'];

        formats.forEach(async (element) => {
            let fileName = beforeKey + element;
            let bucketFilePath = userId + '/basket/' + fileName;
            let file = bucket.file(bucketFilePath);
            
            if(file == null) return null;
            
            file.delete().then(() => {
                console.log(`Successfully deleted - ` + bucketFilePath);
            }).catch(err => {
                console.log(`Failed to delete, error: ${err}`);
            });    
        });

        return null;
    } 
    // Only edit data when it is first created.
    if (change.before.exists() && change.after.exists()) {    
        console.log('Message update - skip');
        return null;
    }

    let currentKey = change.after.key;
    let currentValueRef = change.after.ref;
    let fileUrl = change.after.val();
    
    if(!vaildUrlCheck(fileUrl)) {
        console.error("Not a URI");
        return null;
    }
    
    let userId = context.params.uid;
    let formats = ['.gif', '.mp4'];

    formats.forEach(async (element) => {
        if(element === '.mp4') {
            fileUrl = fileUrl.replace('.gif', '.mp4');
        }
        
        let fileName = currentKey + element;
        let bucketFilePath = userId + '/basket/' + fileName;
        
        const options = {
            destination: bucketFilePath,
            predefinedAcl: 'publicRead'
        };

        let tempFilePath = path.join(os.tmpdir(), fileName);
        
        const download = function(uri, filename, callback) {
            request.head(uri, function(err, res, body){
                // console.log('content-type:', res.headers['content-type']);
                // console.log('content-length:', res.headers['content-length']);
                request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
            });
        };

        await download(fileUrl, tempFilePath, function() {
            bucket.upload(tempFilePath, options).then(function(data) {
                const file = data[0];
                return file.getMetadata();
            }).then(data => {
                const metadata = data[0];
                if(element === '.mp4') {
                    currentValueRef.set(metadata.mediaLink); // db value set
                }
            }).catch(error => {
                console.error(error);
            });;
            console.log('file uploaded');
        });

    });
    
});

function vaildUrlCheck(url) {
    if (validUrl.isUri(url)){
        return true;
    } 
    else {
        return false;
    }
}



var AWS = require('aws-sdk');

AWS.config.loadFromPath(require('path').join(__dirname, './aws-config.json'));
const BUCKET = '';
var s3 = new AWS.S3();

// firebase deploy --only functions
exports.dbDataDeleted = functions.database.ref('/users/{uid}/bucket/{pushId}').onDelete(async (snapshot, context) => {
    // Exit when the data is deleted.
    let fileName = context.params.pushId; // db key
    let s3URL = snapshot.val(); // db val

    var params = {
        Bucket: BUCKET, 
        Delete: { // required
            Objects: [ // required
            {
                Key: fileName + ".gif" // gif
            },
            {
                Key: fileName + ".mp4" // mp4
            }
            ],
        },
    };

    await s3.deleteObjects(params, (err, data) => {
        if (err)  {
            console.log(err, err.stack); // an error occurred
        }
        else {
            console.log(data);           // successful response
        }   
    });
   
});

