var https = require('https'),
	http = require('http'),
	path = require('path'),
	fs = require('graceful-fs'),
	iconv = require('iconv-lite');

var config = {
	urlPath: './url.txt',		//列表文件路径
	path: './cms',				//文件夹路径
	fileType: '.vm',			//指定类型读取
	count: 0
};

/**
 * 遍历文件夹
 * @param  {String}   filePath 文件路径
 * @param  {Function} callback 文件回调处理
 */
function getDic (filePath, callback) {
	fs.readdir(filePath, function (err, file) {
		file.forEach(function (t) {
			fs.stat(filePath + '/' + t, function (err, stats) {
				if (stats.isDirectory()) {
					getDic(filePath + '/' + t, callback);
				}
				else if(stats.isFile() && path.extname(t) === config.fileType){
					fs.readFile(filePath + '/' + t, function (err, data) {
						if(err){
							console.log(err);
						}
						else{
							callback && callback(data, filePath + '/' + t, 'gbk', getFile);
						}
					});
				}
			});
		});
	});
}

/**
 * 分析URL读取文件
 * @param  {[type]}   filePath 文件路径
 * @param  {Function} callback [description]
 */
function getURL (filePath, callback) {
	fs.readFile(filePath, function (err, data) {
		if (err) {
			console.log(err);
		} else{
			data = iconv.decode(data, 'utf8').split('\r\n');	//换行字符问题
			data.forEach(function (t) {
				getFile(t, t, function (URL, file, filePath) {
					callback && callback(file, filePath, 'utf8', getFile)
				});
			});
		}
	});
}

/**
 * 处理文件内容
 * @param  {String}   data     文件内容
 * @param  {String}   filePath 文件路径
 * @param  {String}   code     编码方式
 * @param  {Function} callback 回调
 */
function handleFile (data, filePath, code, callback) {
	data = iconv.decode(data, code);
	// console.log(data)
	var srcURL = data.match(/img src=[\"|\'](.+?)[\"|\']/gi) || [],
		bgURL = data.match(/url\((.+?)\)/gi) || [],
		cssURL = data.match(/href=[\"|\'](.+?)\.css[\"|\']/gi) || [];

	bgURL.forEach(function (t) {
		t = t.slice(4, -1).split(/[\"|\']/);
		if(t[1]){
			t = t[1];
		}
		else{
			t = t[0];
		}
		// console.log(t, filePath, ++config.count);
		callback && callback(t, filePath, setLog);
	});
	srcURL.forEach(function (t) {
		t = t.slice(9, -1);
		// console.log(t, filePath, ++config.count);
		callback && callback(t, filePath, setLog);
	});
	cssURL.forEach(function (t) {
		t = t.slice(6, -1);
		// console.log(t, filePath, ++config.count);
		callback && callback(t, filePath + ' --> ' + t, function (URL, file, filePath) {
			var file = file.toString('utf8');
			// console.log(URL, file)
			handleFile(file, filePath, 'utf8', callback);
		});
	});
}

/**
 * 针对指定链接获取文件大小
 * @param  {String} URL      文件链接
 * @param  {String} filePath 来自文件路径
 */
function getFile (URL, filePath, callback) {
	var protocol = URL.match(/[http|https|data](.+?)\:/gi) || [],
		file = new Buffer('binary');

	protocol = (protocol[0] === 'https:') ? https :
		(protocol[0] === 'http:') ? http : null;

	if(!protocol) {			//协议限制
		return false;
		// callback && callback(URL, file, filePath, "Unkown");
	}
	else{
		protocol.get(URL, function (res) {
			res.on('data', function (data) {
				file += data;
			});
			res.on('end', function () {
				callback && callback(URL, file, filePath, "success");
			});
		}).on('error', function(e) {
			// console.log(file)
			callback && callback(URL, file, filePath, e.message);
		}).end();
	}
}

/**
 * 输出日志
 * @param {String} URL      文件链接
 * @param {String} fileSize 文件大小
 * @param {String} filePath 文件目录
 * @param {String} status   文件状态
 */
function setLog (URL, file, filePath, status) {
	var item = URL + "\t" + file.length + "\t" + filePath + "\t" + status + "\n";

	console.log(item);
	fs.writeFile('./log.txt', item, {flag: "a"}, function (err) {
		if (err) {
			console.log(err.message);
		}
		else{
			console.log(++config.count + ' Saved! ' + item);		//控制台输出日志
		}
	});
}

// getDic (config.path, handleFile);		//以目录获取Log
// getURL (config.urlPath, handleFile);		//以URL列表读取