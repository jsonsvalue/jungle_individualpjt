// #Using express to create a homepage
const express = require('express');
const session = require('express-session');
const app = express();
const port = 3000;
const path = require('path');
// 비밀번호를 Hash function을 통해 암호화하는 Library이다
const argon2 = require('argon2');

//# Mongo DB
// S3에서 저장된 주소에 대한 URL 반환, Mongo DB에는 그 URL 값만 저장한다.
const mongoose = require('mongoose')
const mongoURI = 'mongodb://localhost:27017/MyCanvas'

mongoose.connect(mongoURI);

// 현재 Application과 MongoDB Database를 연결시킨다.
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error'));
db.once('open', () => {
    console.log('Connected to MongoDB');
});

// 1. 유저 정보를 저장하기 위한 Schema 를 형성한다
const userSchema = new mongoose.Schema({
    username : String, 
    password: String, 
    email: String,    
});

// 금방 구축한 userSchema를 User라는 이름의 Database로 저장한다 
const User = mongoose.model('User', userSchema);


// Session관련 정보를 구축한다
app.use(session({
    secret:'yourSecretKey',
    resave: false,
    saveUninitialized: true,
    cookie:{secure:false}
}));

// 2. 토론 게시판 정보를 저장하기 위한 Schema를 형성한다
const debatePostSchema = new mongoose.Schema({
    board:String,
    title:String,
    content:String,
    author: String,
    createdAt:{type: Date, default: Date.now}
});

const DebatePost = mongoose.model('DebatePost', debatePostSchema);


//# POST 요청에서 JSON 데이터를 추출하기 위해서 쓰는 코드이다
app.use(express.json());
app.use(express.urlencoded({extended:true}));

app.use(express.static(path.join(__dirname, 'public')));

//# 1. 홈페이지
app.get('/', (req, res) => 
    res.sendFile(path.join(__dirname, 'public', 'index.html')));

//#2. 로그인
app.post('/login', async(req, res) =>{
    const {email, password} = req.body;
    try{
        // User의 값이 존재한다면, 로그인을 성공적으로 처리시키고 그렇지 않다면 실패 메시지를 띄운다
        const user = await User.findOne({email, password});

        if (user){
            // res.send('Login successful');
            // User의 정보를 session에 저장한다
            req.session.user = {id:user._id, username: user.username};
            res.redirect('/');
        } else{
            res.status(401).send('Invalid email or password');
        }
    } catch(err){
        res.status(500).send('Server Error');
    }
});

//User가 로그인했는지 여부를 확인한다
app.get('/api/session', (req, res)=>{
    if(req.session.user){
        res.json({loggedIn: true, user: req.session.user.username});
    }else{
        res.json({loggedIn:false});
    }
}

);

//현재 로그인한 User의 정보를 가져온다
app.get('api/current-user', (req, res) =>{
    if(req.session.user){
        res.json({username:req.session.user.username});
    }
    else{
        res.json({username:null});
    }
});



app.get('/login', (req, res) =>
    res.sendFile(path.join(__dirname, 'public', 'login.html'))
);

// #3. 로그아웃
app.post('/logout', (req, res)=>{
    req.session.destroy((err) =>{
        if(err){
            return res.status(500).send('Error logging out');
        }
        res.redirect('/');
    });
});


// #4. 회원가입
app.post('/register', async(req, res) => {
    const { username, password, email } = req.body;
    const newUser = new User({username, password, email});
    try{
        // res.send('Registration Successful');
        await newUser.save();
        res.redirect('/login');
    }
    catch(err){
        res.status(500).send('Error saving user');
    }

    // const { username, password, email } = req.body;
    // try{
    //     // argon2를 이용해서 User의 비밀번호를 암호화한다
    //     const hashedPassword = await argon2.hash(password);
    //     console.log('Password Hashed');

    //     // 암호화된 비밀번호를 포함하여, User의 데이터를 저장한다.
    //     const newUser = new User({
    //         username,
    //         password:hashedPassword,
    //         email
    //     });
    //     await newUser.save();
    //     console.log('User saved successfully')
    //     res.redirect('/login');
    // }
    // catch(err){
    //     res.status(500).send('Error saving user');
    // }
    
    // const { username, password, email } = req.body;
    // try {
    //     // Hash the password
    //     const hashedPassword = await argon2.hash(password);
    //     console.log('Password Hashed');
    
    //     // Save the new user with hashed password
    //     try {
    //         const newUser = new User({
    //             username,
    //             password: hashedPassword,
    //             email
    //         });
    
    //         await newUser.save();
    //         console.log('User saved successfully');
    //         res.redirect('/login');
    //     } catch (dbError) {
    //         console.error('Database error:', dbError);
    //         res.status(500).send('Error saving user to database');
    //     }
    // } catch (hashError) {
    //     console.error('Password hashing error:', hashError);
    //     res.status(500).send('Error hashing password');
    // }
        


});


app.get('/register', (req, res)=>
    res.sendFile(path.join(__dirname, 'public', 'register.html'))
);

// #4. 토론 게시판
// 토론 게시판 내용 작성하는 코드이다
app.post('/debate-post', async(req, res)=>{
    // 토론 게시판에서 가져온 내용을 바탕으로, DebatePost DB에 저장한다
    const {board, title, content} = req.body;
    const author = req.session.user ? req.session.user.username: 'Anonymous' // User의 Session 정보에 따라 Author 정보를 저장한다

    const newPost = new DebatePost({
        board, 
        title, 
        content, 
        author
    });

    try{
        await newPost.save();
        res.redirect('/debate');
    }
    catch(err){
        console.error('Error saving debate post:', err);
        res.status(500).send('Error saving the post');
    }
});


app.get('/api/debate', async(req, res)=>{
    try{
        const posts = await DebatePost.find().sort({createdAt:-1}); //게시물을 시간 순서대로 가져온다
        // Render the HTML with posts dynamically (using template engines like EJS or serving static HTML and JavaScript)
        res.json(posts); // debate-post를 통해서 형성한 Database내 게시물을 json 형태로 응답으로 돌려준다.
    }catch(err){
        console.error('Error fetching posts:', err);
        res.status(500).send('Error loading posts');
    }

});



app.get('/debate', (req, res) =>{
    res.sendFile(path.join(__dirname, 'public', 'debate.html'))
});

app.get('/debate-post', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'debate-post.html'));
});



// #5. 과외 게시판
app.get('/lesson', (req, res) =>{
    res.sendFile(path.join(__dirname, 'public', 'lesson.html'))
});

// #6. 실력 향상 게시판
app.get('/enhance', (req, res) =>{
    res.sendFile(path.join(__dirname, 'public', 'enhance.html'))
});


// #7. 소재 게시판
app.get('/picture', (req, res) =>{
    res.sendFile(path.join(__dirname, 'public', 'picture.html'))
});

// #8. 마이페이지
app.get('/mypage', (req, res) =>{
    res.sendFile(path.join(__dirname, 'public', 'mypage.html'))
});





app.get('/about', (req, res) => res.send('About Us: THE EXPRESS GROUP'));

app.get('/intro', (req, res) => res.send('Introduction: 그림쟁이의 그림책'));



app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`)

});