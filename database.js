const sqlite = require('sqlite3').verbose();

const DBSOURCE = "./db/db.sqlite"
let db = new sqlite.Database(DBSOURCE, (err) => {
    if (err) {
      // Cannot open database
      console.error(err.message)
      throw err
    }else{
        console.log('Connected to the SQLite database.');

        db.serialize(() => {
            //db.run('drop table tests');

            db.prepare(`CREATE table IF NOT EXISTS 
                        users(id INTEGER PRIMARY KEY AUTOINCREMENT, 
                        name text, 
                        password text,
                        isAdmin BOOLEAN DEFAULT 0,
                        UNIQUE(name))`).run(function(err)  {
                if(err) console.log(err.message);
                else {
                    db.serialize(()=> {
                        db.prepare(`INSERT INTO users(name,password,isAdmin) VALUES(?,?,?)`).run(['1', '1', 1], function (err) {
                            if (err) console.log(err.message);
                        });
                        // db.all(`select * from users`, function (err,rows){
                        //         console.log(err ? err.message: rows);
                        // });
                        db.prepare(`CREATE table IF NOT EXISTS 
                                        topics (id INTEGER PRIMARY KEY AUTOINCREMENT, 
                                        topic text UNIQUE, 
                                        author_id INTEGER, 
                                        FOREIGN KEY(author_id) REFERENCES users(id)
                                        )`).run( function (err){
                                            if(err) console.log(err.message);
                                            else{
                                                // db.prepare(`INSERT INTO
                                                //                 topics(topic,author_id)
                                                //                 VALUES('other',1)`).run(function(err){
                                                //                     if(err) console.log(err);
                                                // });
                                            }
                        });
                        db.run(`CREATE TABLE IF NOT EXISTS words (
                                id_word INTEGER PRIMARY KEY AUTOINCREMENT,
                                word text UNIQUE NOT NULL, 
                                translation text, 
                                transcription text,
	                            topic_id INTEGER,
	                            image text,
	                            audio text,
	                            optional text,
	                            FOREIGN KEY(topic_id) REFERENCES topics(id)
                                )`,
                                function(err) {
                                    if (err) {
                                        console.log(err.message);
                                    }
                                }
                            );
                    });
                }
            });
            db.prepare(`CREATE table IF NOT EXISTS 
                        tests(id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name text,
                        words_ids text,
                        author_id INTEGER DEFAULT NULL,                       
                        UNIQUE(name,author_id))`).run(function (err) {
                if (err) {
                    console.log(err.message);
                }
            });


        });
    }
});


module.exports = db