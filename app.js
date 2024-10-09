// #Using express to create a homepage
const express = require('express');
const session = require('express-session');
const app = express();
const port = 3000;
const path = require('path');
// 비밀번호를 Hash function을 통해 암호화하는 Library이다
const argon2 = require('argon2');

//#EJS 를 View Engine으로 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

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

app.get('/debate-post', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'debate-post.html'));
});


app.get('/debate', async (req, res) => {
    try {
        const posts = await DebatePost.find().sort({ createdAt: -1 });
        res.render('debate', { posts });
    } catch (err) {
        console.error('Error fetching posts:', err);
        res.status(500).send('Error loading posts');
    }
});

// app.get('/api/debate', async(req, res)=>{
//     try{
//         const posts = await DebatePost.find().sort({createdAt:-1}); //게시물을 시간 순서대로 가져온다
//         // Render the HTML with posts dynamically (using template engines like EJS or serving static HTML and JavaScript)
//         res.json(posts); // debate-post를 통해서 형성한 Database내 게시물을 json 형태로 응답으로 돌려준다.
//     }catch(err){
//         console.error('Error fetching posts:', err);
//         res.status(500).send('Error loading posts');
//     }

// });


//# 토론 게시판의 Comment 관련 database를 구축하기 위한 코드이다
const commentSchema = new mongoose.Schema({
    postId : {type:mongoose.Schema.Types.ObjectId, ref:'DebatePost'},
    author : String,
    content : String,
    createdAt : {type:Date, default:Date.now}
});

const Comment = mongoose.model('Comment', commentSchema);

// 토론 게시판의 Comment 관련 data를 저장하기 위한 코드이다
app.post('/debate-content/:id/comment', async(req,res)=>{
    const postId = req.params.id;
    const {content} = req.body;
    const author = req.session.user? req.session.user.username : 'Anonymous';
    
    // Comment관련 data를 변수에 저장하고, 
    const newComment = new Comment({
        postId,
        author, 
        content,
    });

    try{
    // 해당 변수를 database에 저장하고 해당 게시물을 보여주는 코드이다   
        await newComment.save();
        res.redirect(`/debate-content/${postId}`);
    }catch(err){
        console.error('Error saving comment:', err);
        res.status(500).send('Error saving comment');
    }

});

// # 토론 게시판의 게시물을 id를 통해서 가져와서 Server에서 rendering을 한 후, Client에게 보여준다.
app.get('/debate-content/:id', async (req, res) => {
    try {
        const postId = req.params.id;
        const post = await DebatePost.findById(postId);
        // Comment 가 형성되지 않더라도, 비어 있는 Array로 구성되도록 한다
        const comments = await Comment.find({ postId }).sort({ createdAt: -1 }) || [];

        if (!post) {
            return res.status(404).send('Post not found');
        }
        // user가 로그인 돼 있는지 여부와 그 user가 해당 post를 쓴 사람과 동일한지 여부를 확인하고, Client에게 해당 정보를 넘기는 코드이다
        const isAuthor = req.session.user && req.session.user.username == post.author;
        
        //post,comment 관련 데이터를 Server에서 rendering하고, Client에게 보여준다
        res.render('debate-content', { post, comments, isAuthor });
    } catch (err) {
        console.error('Error fetching post or comments:', err);
        res.status(500).send('Error loading post or comments');
    }
});

// # 토론 게시판의 게시물을 user 가 수정/삭제하기 위한 코드이다
// 토론 게시판의 게시물을 수정하기 위한 코드이다
// 게시물을 수정하기 위한 페이지를 가져온다
app.get('/debate-content/:id/edit', async (req, res) => {
    try {
        const postId = req.params.id;
        const post = await DebatePost.findById(postId);

        if (!post) {
            return res.status(404).send('Post not found');
        }

        // 로그인을 한 User가 게시물을 작성한 User와 동일한지 확인하는 코드이다
        if (req.session.user && req.session.user.username === post.author) {
            res.render('debate-edit-post', { post });
        } else {
            res.status(403).send('You are not authorized to edit this post.');
        }
    } catch (err) {
        console.error('Error fetching post for editing:', err);
        res.status(500).send('Error loading post for editing');
    }
});

// 게시물의 수정한 내용을 저장하는 코드이다
app.post('/debate-content/:id/edit', async (req, res) => {
    try {
        const postId = req.params.id;
        const { title, content } = req.body;
        const post = await DebatePost.findById(postId);

        if (!post) {
            return res.status(404).send('Post not found');
        }

        // 수정한 게시물의 내용을 저장하는 코드이다
        if (req.session.user && req.session.user.username === post.author) {
            post.title = title;
            post.content = content;
            await post.save();
            res.redirect(`/debate-content/${postId}`);
        } else {
            res.status(403).send('You are not authorized to edit this post.');
        }
    } catch (err) {
        console.error('Error updating post:', err);
        res.status(500).send('Error updating post');
    }
});

// 게시물의 내용을 삭제하는 코드이다
app.post('/debate-content/:id/delete', async(req,res)=>{
    try{
        const postId = req.params.id;
        const post = await DebatePost.findById(postId);

        if(!post){
            return res.status(404).send('Post not found');
        }
    
        if(req.session.user && req.session.user.username == post.author){
            await DebatePost.deleteOne({_id:postId});
            await Comment.deleteMany({postId:postId});
            res.redirect('/debate');
        }else{
            res.status(403).send('You are not authorized to delete this post');
        }
    }catch(err){
        console.error('Error deleting post:', err);
        res.status(500).send('Error deleting post');
    }
});


// #5. 소재 게시판
// # 사진을 저장하기 위한 Database를 구축하는 코드이다
const picturePostSchema = new mongoose.Schema({
    title: String,
    author: String,
    content: String,
    imageUrl: String,
    createdAt: { type: Date, default: Date.now }
});

// Create a model from the schema
const PicturePost = mongoose.model('PicturePost', picturePostSchema);

// # 사진을 S3 데이터베이스에 저장하기 위한 코드이다
// env 파일에 있는 S3관련 정보를 쓸 수 있게 해주는 것이, npm install dotenv를 통해서 가능하다 
require('dotenv').config();

const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// Set up Multer for handling file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Configure the S3 client
const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

app.post('/picture-post', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send('No file uploaded');
        }

        // Extract data from the form
        const { title, content } = req.body;
        const author = req.session.user ? req.session.user.username : 'Anonymous'; // Determine the author based on session info

        // Set up S3 upload parameters
        const params = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: `${Date.now()}_${req.file.originalname}`,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
            // ACL: 'public-read'
        };

        // Upload file to S3
        const command = new PutObjectCommand(params);
        const data = await s3.send(command);
        const imageUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${params.Key}`;

        // Save the post data to the database
        const newPicturePost = new PicturePost({
            title,
            author,
            content: content,
            imageUrl
        });

        await newPicturePost.save();
        res.redirect('/picture');
        // res.status(200).json({ message: 'File uploaded successfully', url: imageUrl });
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).send('Error uploading file');
    }
});

// #소재 게시판의 내용을 모두 보여준다.
app.get('/picture', async (req, res) => {
    try {
        // Fetch all picture posts from the database
        const posts = await PicturePost.find().sort({ createdAt: -1 });

        // Render the picture.ejs file with the fetched data
        res.render('picture', { posts });
    } catch (error) {
        console.error('Error fetching picture posts:', error);
        res.status(500).send('Error loading picture posts');
    }
    // res.sendFile(path.join(__dirname, 'public', 'picture.html'))
});

// # 소재 게시판의 게시물을 id를 통해서 가져와서 Server에서 rendering을 한 후, Client에게 보여준다.
app.get('/picture-content/:id', async (req, res) => {
    try {
        const postId = req.params.id;
        const post = await PicturePost.findById(postId);
        // Comment 가 형성되지 않더라도, 비어 있는 Array로 구성되도록 한다
        const comments = await Comment.find({ postId }).sort({ createdAt: -1 }) || [];

        if (!post) {
            return res.status(404).send('Post not found');
        }
        // user가 로그인 돼 있는지 여부와 그 user가 해당 post를 쓴 사람과 동일한지 여부를 확인하고, Client에게 해당 정보를 넘기는 코드이다
        const isAuthor = req.session.user && req.session.user.username == post.author;
        
        //post,comment 관련 데이터를 Server에서 rendering하고, Client에게 보여준다
        res.render('picture-content', { post, comments, isAuthor });
    } catch (err) {
        console.error('Error fetching post or comments:', err);
        res.status(500).send('Error loading post or comments');
    }
});


app.get('/picture-post', async(req, res)=>{


});


// #6. 실력 향상 게시판
app.get('/enhance', (req, res) =>{
    res.sendFile(path.join(__dirname, 'public', 'enhance.html'))
});


// #7. 과외 게시판
app.get('/lesson', (req, res) =>{
    res.sendFile(path.join(__dirname, 'public', 'lesson.html'))
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