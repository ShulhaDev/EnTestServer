const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer  = require('multer')

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        switch(file.mimetype.split('/')[0]){
            case 'image':
                cb(null, __dirname + '/public/images/')
                break;
            case 'audio':
                cb(null, __dirname + '/public/audio/');
                break;
            default:
                break;
        }

    },
    filename: function (req, file, cb) {
        if(!file) return;
        switch(file.mimetype.split('/')[0]){
            case 'image':
                cb(null, file.originalname + '.jpg')
                break;
            case 'audio':
                cb(null, file.originalname + '.mp3');
                break;
            default:
                break;
        }
    }
});
const upload = multer({ storage })
//const FileReader = require('filereader');

const app = express();
const port = process.env.PORT || 5000;
const location = `http://localhost:${port}`

//const fs = require('fs');
const db = require("./database");

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(cors());
app.use(express.static(__dirname + '/public'));

app.get("/pictures/:word", (req, res) => {
  let word = req.params.word;
  let filePath = __dirname + `/public/images/${word}.jpg`
  res.sendFile(filePath);
});

app.get("/word/filter", (req, res) => {
    if(!req.query) {
        res.json({
            "error":"Bad Request: no filter passed"
        });
        return;
    }
    const [key,value] = Object.values(req.query);

    let sql;
    switch (key){
        case "word":
            sql = `select words.*,topics.topic from words left join topics on words.topic_id = topics.id where word LIKE '%${req.query.value}%'`;
            break;
        case "topic":
            sql = `select words.*,topics.topic from words left join topics on words.topic_id = topics.id ${value?`where topic='${value}'`:''}`;
                break;
        default:
            break;
    }

    db.all(sql, (err, rows) => {
        if (err) {
            console.log(err.message);
          res.status(400).json({"error":err.message});
          return;
        }
        res.json({
            "message":"ok",
            "data":rows
        })
      });
});

app.get("/users", (req, res) => {
    let sql = `select name from users `;
    db.all(sql,function(err,rows){
        if(err) {
            console.log(err.message);
            res.send({"err": `Error occurred while getting users: ${err.message}`});
        }
        else
            res.send({"data": rows});
    });
});

app.get("/users/check", (req, res) => {
    let userData = req.query;
    console.log(userData);
    let sql = `select * from users where name=? and password=?`;
    db.all(sql,[userData.login,userData.password],function(err,rows){
        if(err) {
            res.status(500).send({"error": err});
        }
        else {
            console.log(rows);
            if (rows && rows.length > 0) {
                res.status(200).json({"message": "ok", "data": {id: rows[0].id, name: rows[0].name,isAdmin: rows[0].isAdmin}});
            }
            else
                res.status(401).send({"error": {password: "Wrong password"}});
        }

    });
});

app.post("/users/add", (req, res) => {

    console.log(req.body);
    const userInfo = req.body.userInfo;
    const sql = `Insert into users (name,password,isAdmin) VALUES (?,?,?)`;
    const params = [userInfo.name, userInfo.password, 0];

    db.run(sql,params,function(err){
        if(err){
            console.log(err.message);
            res.json({"error": err});
        }
        else
            res.json({"message": "ok", data: {user: userInfo.name}})
    });

});

app.get("/topics", (req, res) => {
    let topic = req.query.value;
    let sql = `select topics.id,topics.topic,users.name 
                from topics left join users on topics.author_id = users.id`
                + (topic?` where topic LIKE '%${req.query.value}%'`:'') + ` ORDER BY topic ASC`;
    db.all(sql, (err, rows) => {
        if (err) {
            console.log('topics like error: ' + err.message);
            res.status(400).json({"error":err.message});
            return;
        }
        res.json({
            "message":"ok",
            "data":rows
        })
    });
});

app.get("/tests", (req, res) => {

    const user_id = req.query.user_id;

    // load topic tests
    let sql = `select words.id_word, words.word,words.topic_id, topics.topic 
    from words left join topics on words.topic_id = topics.id ORDER BY topics.topic ASC,words.word ASC`;

    db.all(sql,function(err,rows) {
       if(err)
           res.json({error: 'Unable to load words: ' + err.message});
       else
           sortByTopics(rows);
    });

    const sortByTopics = (words) => {
        let topics = [];
        words.forEach(word => {
            if (!topics.find(topic => topic === word.topic))
                topics.push(word.topic);
        });
        let topicTests = [];

        topics.forEach(
            (topic,index) => {
                topicTests.push({
                    id: -index - 1,
                    name: topic,
                    author_id: undefined,
                    words_ids: (words) ? words.reduce(
                        (total, word) => {
                            if (word.topic === topic)
                                total = total + (total ? ',' : '') + word.id_word;
                            return total;
                        },
                        ''
                    ) : ''
                })
            }
        );
        assembleTests(topicTests);
    }
    const assembleTests = (tests) => {
        let sql = `select tests.id,tests.name,tests.words_ids,tests.author_id 
                from tests` + (user_id > 0 ? ` where author_id = ?  ORDER BY name ASC`:``);
        let params = (user_id > 0?[+user_id]:[]);
        db.all(sql, params, (err, rows) => {
            if (err) {
                console.log('tests load error: ' + err.message);
                res.status(400).json({"error":err.message});
                return;
            }
            let resTests = (tests && [...tests]) || [];
            if(rows && rows.length>0)
                resTests = [...resTests,...rows];
            res.json({
                "message":"ok",
                "data":resTests
            })
        });
    }

});

app.post("/tests/remove", async (req, res) => {
    const id =  req.body.id;
    if (id)
    {
        const sql = "Delete from tests where id = ?";
        db.run(sql,[id],function(err){
            if(err){
                console.log(err.message);
                res.json({"error": err.message});
            }
            else
                res.json({"message": "ok", "data" : id})
        })
    }
});

app.post("/tests/update", async (req, res) => {
    const testData = req.body.value;
    let sql;
    let params;
    let words_ids = testData.words_ids.join(',');
    console.log(testData);
    if(testData.id){
        sql = 'UPDATE tests SET name = ?, words_ids = ?,author_id = ? WHERE id = ?';
        params = [testData.name,words_ids,testData.author_id,testData.id];
    }
    else{
        sql = 'INSERT INTO tests (name,words_ids,author_id) VALUES (?,?,?)';
        params = [testData.name,words_ids,testData.author_id];
    }
    db.run( sql, params, function(err) {
        if(err) {
            res.json({'error': 'Error occurred while trying to insert/update test: ' + err.message});
            console.log(err.message);
        }
        else{
            res.json({'message': "ok", 'data': {test_id: testData.id || this.lastID,author_id: testData.author_id}})
        }
    })
});


app.post("/upload/image",  upload.single('image'), async (req, res) => {
    let file = req.file;
    console.log(file);
    res.send({"message" : "ok", "data": file && (location + `/pictures/${file.originalname}`) });
});

app.get("/db_query",async (req,res) => {
    // let sql = `UPDATE topics set topic = ? WHERE id = ?`;
    // let sql = `Select users.* from users`;
    let sql = `Select tests.* from tests`;
    // let sql = `Delete from topics where id = ? or id = ? or id = ?`;
    // let sql = `Delete from users where id > 7`;
    // let params = ['other',1];
    await db.all(sql,[], (err,rows) => {
        if(err) console.log(err.message);
         res.send({"result":rows});
    });
    // res.send({"result":"ok"});
    //res.send({"result":rows});
});

app.post("/words/:activity", async (req, res) => {

    const word = req.body.value.word;
    const id_word = req.body.value.id_word;
    const translation = req.body.value.translation;
    const transcription = req.body.value.transcription;
    const topic = req.body.value.topic;
    const image = req.body.value.image;
    const audio = req.body.value.audio;

    let activity = req.params.activity;
    let userId = req.body.userId;
    let topic_id = !topic ? 1 : undefined;
    let sql = `Select topics.id from topics WHERE topics.topic = ?`;
    db.all(sql, [topic], function (err, rows) {
        if (err) console.log(err.message);
        if (rows && rows.length > 0) topic_id = rows[0].id;
        if (!topic_id) {
            db.run(`INSERT INTO topics(topic,author_id) VALUES(?,?)`, [topic, userId], function (err) {
                if (err) {
                    console.log(err.message);
                    res.status(400).json({"error": "Error occurred while getting topic id"});
                } else{
                    topic_id = this.lastID;
                    doPost();
                }
            });
        } else {
            doPost();
        }
    });

    const doPost = () => {
        let params;
        switch (activity) {
            case 'add':
                sql = 'INSERT INTO words(word,translation,transcription,topic_id,image,audio) VALUES (?,?,?,?,?,?)';
                params = [word, translation, transcription, topic_id, image, audio];
                break;
            case 'update':
                sql = 'UPDATE words SET translation=?,transcription=?,topic_id=?,image=?,audio=? WHERE word = ?';
                params = [translation, transcription, topic_id, image, audio, word];
                break;
            default:
                return;
        }

        db.run(sql, params, function(err){
            if (err) {
                console.log(err.message);
                res.status(400).json({"error": err.message});
            }
            res.json({
                "message": "ok",
                "data" : {
                    "topic" : {topic_id, topicName: topic||'other',author_id: userId},
                    "id_word": id_word || this.lastID,
                    userId
                }
            });
        });
    }

});

app.post("/word/remove", async (req, res) => {
    const id_word =  req.body.id_word;
    if (id_word)
    {
        const sql = "Delete from words where id_word = ?";
        db.run(sql,[id_word],function(err){
            if(err){
                console.log(err.message);
                res.json({"error": err.message});
            }
            else
                res.json({"message": "ok", "data": id_word})
        })
    }
});


// start express server on port 5000
app.listen(port, () => {
  console.log(`server started on port ${port}`);
});

app.use(function(req, res){
    res.status(404);
});