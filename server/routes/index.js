let express = require('express');
let router = express.Router();

let Crawler = require('crawler');
let fs = require('fs');
let path = require('path');
let request = require('request');
let mkdirs = require('../util/mkdirs');
let dataUrl = path.resolve(__dirname, '../../data');
let root = 'https://www.dytt8.net';

/* GET home page. */
router.get('/', function(req, res, next) {
  let c = new Crawler({
        // 在每个请求处理完毕后将调用此回调函数
        callback : function (error, resData, done) {
            if(error){
                console.log(error);
                res.render('index', { title: '电影天堂', content: error });
            }else{
                var $ = resData.$;
                let $dataList = $(".bd3r .co_content8 ul table");
                let paging = $(".bd3r .co_content8 .x");
                let listData = []; 

                // 分页处理
                let sel = paging.find('select');
                let maxLen = sel.children().length;
                let currPage = sel.find('[selected]').text();

                $dataList.each((key, item)=>{
                  let $a = $(item).find('a');
                  let dac = $(item).find('font').text();
                  let content = $(":last-child",item).find('td').text();
                  
                  dac.match(/(\d{4}-\d{2}-\d{2} [\d:]+)\D*(\d+)/);
                  listData.push({"name": $a.text(),
                                  "href": root+$a.attr('href'),
                                  "date": RegExp.$1,
                                  "clickNum": RegExp.$2,
                                  "content": content
                                });
                });
                createFs(currPage, listData);

                let listUrl = [];
                for(let i=2;i<=maxLen;i++){
                  listUrl.push(root+'/html/gndy/dyzz/list_23_'+i+'.html');
                }
                getPageNum(listUrl);
                res.render('index', { title: '电影天堂', content: listData });
            }
            done();
        }
    });

  // 将一个URL加入请求队列，并使用默认回调函数
  c.queue(root+'/html/gndy/dyzz/list_23_1.html');
});

// 获取当前页的数据
function getPageNum(listUrl){
  let c = new Crawler({
    // 在每个请求处理完毕后将调用此回调函数
    callback : function (error, resData, done) {
        if(error){
            console.log(error);
        }else{
            var $ = resData.$;
            let $dataList = $(".bd3r .co_content8 ul table");
            let paging = $(".bd3r .co_content8 .x");
            let listData = []; 

            // 分页处理
            let sel = paging.find('select');
            let maxLen = sel.children().length;
            let currPage = sel.find('[selected]').text();

            $dataList.each((key, item)=>{
              let $a = $(item).find('a');
              let dac = $(item).find('font').text();
              let content = $(":last-child",item).find('td').text();
              
              dac.match(/(\d{4}-\d{2}-\d{2} [\d:]+)\D*(\d+)/);
              listData.push({"name": $a.text(),
                              "href": root+$a.attr('href'),
                              "date": RegExp.$1,
                              "clickNum": RegExp.$2,
                              "content": content
                            });
            });

            createFs(currPage, listData);
        }
        done();
    }
});

// 将一个URL加入请求队列，并使用默认回调函数
c.queue(listUrl);
}

// 遍历当前页的条数
async function createFs(page, content){
  let url =  path.join(dataUrl,'./'+page);
  let file = path.join(url, './mkdir.json'); 
  // 如果不存在创建目录，支持多层创建，异步
  await mkdirs(url);
  await (()=>{
    let p = new Promise((resolve,reject)=>{
      fs.writeFile(file, JSON.stringify(content), (err)=>{
        if(err){
          resolve(false);
          console.log(err);
        }else{
          resolve(true);
        }
      });
    });
    return p;
  })();
  for(let item of content){
    detailContent(item, url);
  }
}

// 获取具体信息
async function detailContent(item, rootUrl){
  let dirUrl = path.join(rootUrl,'./'+item.name.replace(/[\\\/:*?"<>|]/g,"-"));
  let file = path.join(dirUrl,'./detail.json');
  await mkdirs(dirUrl);

  let c = new Crawler({
    callback(error, resData, done){
      if(error){
        console.log(error);
      }else{
        let data = {};
        let $ = resData.$;
        let $content = $('.bd3r .co_area2');
        let contentStr = $content.find('#Zoom p').eq(0).text();
        let imgList = [];
        data.title = $content.find('.title_all font').text();
        data.content = contentStr.substr(0,contentStr.indexOf('【下载地址】'));
        $content.find('#Zoom img').each(function(key, it){
          imgList.push($(it).attr('src'));
        });
        data.img = imgList;
        data.magnet = $content.find('[href^="magnet"]').attr('href');
        data.thunder = $content.find('[vkorgxpv]').attr('vkorgxpv');
        fs.writeFile(file, JSON.stringify(data), err=>{
          if(err){
            console.log(err);
          }
        });
        // getImg(JSON.stringify(imgList), dirUrl);
      }
      done();
    }
  });
  c.queue(item.href);
}

// 图片下载处理
// 由于某些问题无法正确获取到图片,并且会报错而无法爬取下去
function getImg(imgList, dirUrl){
  // var c = new Crawler({
  //     encoding:null,
  //     jQuery:false,// set false to suppress warning message.
  //     callback:function(err, res, done){
  //         if(err){
  //             console.error(err.stack);
  //         }else{
  //           console.log(res.options.filename);
  //           console.log(res.body);
  //             fs.createWriteStream(res.options.filename).write(res.body);
  //         }
  //         done();
  //     }
  // });
  imgList = JSON.parse(imgList);
  imgList = imgList.map((item, key)=>{
    return {uri: item, filename: path.join(dirUrl,"./"+key+".jpg")};
  });
  // c.queue(imgList);
  for(let ii = 0; ii<imgList.length; ii++){
    if(!fs.existsSync(imgList[ii].filename)){
      setTimeout(()=>{
        let options = {
          url: imgList[ii].uri,
          headers: {
            'content-length': 1001976
          }
        };
        
        request(options).pipe(fs.createWriteStream(imgList[ii].filename)).on('close',function(){
          console.log("关闭..."+imgList[ii].filename);
          });
      },1000);
    }
  }
}

module.exports = router;
