//jshint esversion:6
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose=require('mongoose');
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const app=express();


const { google } = require('googleapis');
const fs = require('fs');

const credentials = require('./credentials.json');

const scopes = [
  'https://www.googleapis.com/auth/drive'
];

const imglist = [];
function print(imglist){
  for(let i=0;i<imglist.length;i++){
    console.log("The img is: "+imglist[i]);
  }
}


const auth = new google.auth.JWT(
  credentials.client_email, null,
  credentials.private_key, scopes
);

const drive = google.drive({ version: 'v3', auth });
const sheets = google.sheets({ version: 'v4', auth });

(async function () {

  let res = await drive.files.list({
    pageSize: 20,
    fields: 'files(name,fullFileExtension,webViewLink)',
    orderBy: 'createdTime desc'
  });

  // Create a new spreadsheet
  let newSheet = await sheets.spreadsheets.create({
    resource: {
      properties: {
        title: 'Another Day, Another Spreadsheet',
      }
    }
  });

  // Move the spreadsheet
  const updatedSheet = await drive.files.update({
    fileId: newSheet.data.spreadsheetId,
    // Add your own file ID:
    addParents: '1_qOJ0z3kI_e2IJq4X6HqF0T1ROBESygS',
    fields: 'id, parents'
  });

  // Transfer ownership
  await drive.permissions.create({
    fileId: newSheet.data.spreadsheetId,
    transferOwnership: 'true',
    resource: {
      role: 'owner',
      type: 'user',
      // Add your own email address:
      emailAddress: 'officialmdayush23@gmail.com'
    }
  });

  // Add data as new rows
  let sheetData = [['File Name', 'URL']];

  res.data.files.map(entry => {
    const { name, webViewLink } = entry;
    sheetData.push([name, webViewLink]);
  });

  sheets.spreadsheets.values.append({
    spreadsheetId: newSheet.data.spreadsheetId,
    valueInputOption: 'USER_ENTERED',
    range: 'A1',
    resource: {
      range: 'A1',
      majorDimension: 'ROWS',
      values: sheetData,
    },
  });

  // Add styling to the first row
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: newSheet.data.spreadsheetId,
    resource: {
      requests: [
        {
          repeatCell: {
            range: {
              startRowIndex: 0,
              endRowIndex: 1
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: {
                  red: 0.2,
                  green: 0.2,
                  blue: 0.2
                },
                textFormat: {
                  foregroundColor: {
                    red: 1,
                    green: 1,
                    blue: 1
                  },
                  bold: true,
                }
              }
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat)'
          }
        },
      ]
    }
  });

  // Back-up data locally
  let data = 'Name,URL\n';

  res.data.files.map(entry => {
    const { name, webViewLink } = entry;
    data += `${name},${webViewLink}\n`;
  });

  fs.writeFile('data.jpg', data, (err) => {
    if (err) throw err;
  });

})

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(session({
  secret: "Our little secret.",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/userDB", {useNewUrlParser: true});

const userSchema=new mongoose.Schema({
    username:String,
    password:String
})

// const imgSchema=new mongoose.Schema({
//   imgurl:String
// })

userSchema.plugin(passportLocalMongoose);

const User=mongoose.model("User",userSchema);
// const Image = mongoose.model("User", imgSchema)

passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());

passport.deserializeUser(User.deserializeUser());

app.get("/", function(req, res){
  res.render("home");
});

app.get("/register",function(req,res){
    res.render("register")
})

app.get("/login",function(req,res){
    res.render("login");
})

app.get("/secret",function(req,res){
  if(req.isAuthenticated()){
    res.render("secret");
  }else{
    res.redirect("/login");
  }
})

// post route is used to avoid accidental logouts

// app.get('/logout', function(req, res, next){
//   req.logout(function(err) {
//     if (err) { return next(err); }
//     res.redirect('/');
//   });
// });

app.post('/logout', function(req, res, next){
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/');
  });
});

app.post("/register",function(req,res){

    // const username=req.body.username;
    // const password=req.body.password;

    // const user=new User({
    //     username:username,
    //     password:password
    // })
    
    // user.save();

    // res.redirect("/login")
    User.register({username: req.body.username}, req.body.password, function(err, user){
      if (err) {
        console.log(err);
        res.redirect("/register");
      } else {
        passport.authenticate("local")(req, res, function(){
          print(imglist);
          res.redirect("/secret");
        });
      }
    });
})

app.post("/login",function(req,res){
  // const username=req.body.username;
  // const password=req.body.password;
  // User.findOne({username:username},function(err,user){
  //   if(err){
  //     console.log("error");
  //     res.redirect("/login");
  //   }else{
  //     if(user){
  //       if(user.password===password){
  //         console.log("found");
  //         res.render("secret");
  //       }else{
  //         console.log("not found");
  //         res.redirect("/login");
  //       }
  //     }else{
  //       console.log("not found");
  //       res.redirect("/login");
  //     }
  //   }
  // });
  const user=new User({
    username:req.body.username,
    password:req.body.password
  })
  req.login(user,function(err){
    if(err){
      console.log(err);
    }else{
      passport.authenticate("local")(req,res,function(){
        res.redirect("/secret");
      })
    }
  })
})

drive.files.list({}, (err, res) => {
  if (err) throw err;
  const files = res.data.files;
  if (files.length) {
  files.map((file) => {
    // db.imgSchema.insertOne({imgurl:file.id})
    imglist.push(file.id);
    console.log(file);
  });
  } else {
    console.log('No files found');
  }
});

app.listen(3000, function() {
  console.log("Server started on port 3000.");
});
