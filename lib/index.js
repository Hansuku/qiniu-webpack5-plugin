'use strict';

var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var path = require('path');
var chalk = require('chalk');
var _ = require('lodash');
var qiniu = require('qiniu');
var Buffer = require('buffer').Buffer;
var zlib = require('zlib');
var mime = require('mime');

var defaultConfig = {
  auth: {
    accessKeyId: '',
    accessKeySecret: '',
    bucket: '',
    region: ''
  },
  retry: 3,
  existCheck: true,
  ossBaseDir: 'auto_upload_ci',
  project: '',
  prefix: '',
  exclude: /.*\.html$/,
  enableLog: false,
  ignoreError: false,
  removeMode: true,
  gzip: false,
  envPrefix: '',
  includeDir: [],
  options: undefined
};

var red = chalk.red;
var green = chalk.bold.green;

module.exports = function () {
  function WebpackQINIUOSSPlugin(cfg) {
    (0, _classCallCheck3.default)(this, WebpackQINIUOSSPlugin);

    var envConfig = {
      auth: {
        accessKeyId: process.env[((cfg || {}).envPrefix || defaultConfig.envPrefix) + 'WEBPACK_QINIUOSS_PLUGIN_ACCESS_KEY_ID'],
        accessKeySecret: process.env[((cfg || {}).envPrefix || defaultConfig.envPrefix) + 'WEBPACK_QINIUOSS_PLUGIN_ACCESS_KEY_SECRET'],
        bucket: process.env[((cfg || {}).envPrefix || defaultConfig.envPrefix) + 'WEBPACK_QINIUOSS_PLUGIN_BUCKET'],
        region: process.env[((cfg || {}).envPrefix || defaultConfig.envPrefix) + 'WEBPACK_QINIUOSS_PLUGIN_REGION']
      },
      enableLog: extraEnvBoolean(process.env[((cfg || {}).envPrefix || defaultConfig.envPrefix) + 'WEBPACK_QINIUOSS_PLUGIN_ENABLE_LOG']),
      ignoreError: extraEnvBoolean(process.env[((cfg || {}).envPrefix || defaultConfig.envPrefix) + 'WEBPACK_QINIUOSS_PLUGIN_IGNORE_ERROR']),
      removeMode: extraEnvBoolean(process.env[((cfg || {}).envPrefix || defaultConfig.envPrefix) + 'WEBPACK_QINIUOSS_PLUGIN_REMOVE_MODE']),
      ossBaseDir: process.env[((cfg || {}).envPrefix || defaultConfig.envPrefix) + 'WEBPACK_QINIUOSS_PLUGIN_OSS_BASE_DIR'],
      prefix: process.env[((cfg || {}).envPrefix || defaultConfig.envPrefix) + 'WEBPACK_QINIUOSS_PLUGIN_PREFIX'],
      includeDir: process.env[((cfg || {}).includeDir || defaultConfig.includeDir) + 'WEBPACK_QINIUOSS_PLUGIN_INCLUDE_DIR']
    };
    this.config = _.mergeWith(_.cloneDeep(defaultConfig), envConfig, cfg || {}, configMergeCustomizer);
    if (typeof this.config.retry !== 'number' || this.config.retry < 0) {
      this.config.retry = 0;
    }
    this.calcPrefix();
    this.debug('默认配置:', defaultConfig);
    this.debug('环境变量配置:', envConfig);
    this.debug('项目配置:', cfg);
    this.debug('最终使用的配置:', this.config);

    var mac = new qiniu.auth.digest.Mac(this.config.auth.accessKeyId, this.config.auth.accessKeySecret);
    this.client = new qiniu.form_up.FormUploader({
      scope: this.config.auth.bucket
    });
    var putPolicy = this.config.auth.putPolicy = new qiniu.rs.PutPolicy({
      scope: this.config.auth.bucket
    });
    this.config.auth.uploadToken = putPolicy.uploadToken(mac);
    this.config.auth.putExtra = new qiniu.form_up.PutExtra();
    this.bucketManager = new qiniu.rs.BucketManager(mac, new qiniu.conf.Config());
  }

  (0, _createClass3.default)(WebpackQINIUOSSPlugin, [{
    key: 'apply',
    value: function apply(compiler) {
      var _this = this;

      if (compiler.hooks && compiler.hooks.emit) {
        compiler.hooks.emit.tapAsync('WebpackQINIUOSSPlugin', function (compilation, cb) {
          _this.pluginEmitFn(compilation, cb);
        });
      } else {
        compiler.plugin('emit', function (compilation, cb) {
          _this.pluginEmitFn(compilation, cb);
        });
      }
    }
  }, {
    key: 'pluginEmitFn',
    value: function pluginEmitFn(compilation, cb) {
      var _this2 = this;

      var files = this.pickupAssetsFiles(compilation);
      log('' + green('\nOSS 上传开始......'));
      this.uploadFiles(files, compilation).then(function () {
        log('' + green('OSS 上传完成\n'));
        cb();
      }).catch(function (err) {
        log(red('OSS 上传出错') + '::: ' + red(err.code) + '-' + red(err.name) + ': ' + red(err.message));
        _this2.config.ignoreError || compilation.errors.push(err);
        cb();
      });
    }
  }, {
    key: 'calcPrefix',
    value: function calcPrefix() {
      if (this.finalPrefix) return this.finalPrefix;

      if (this.config.prefix) {
        this.finalPrefix = this.config.prefix;
      } else {
        if (!this.config.project) {
          warn('\u4F7F\u7528\u9ED8\u8BA4\u4E0A\u4F20\u76EE\u5F55: ' + this.config.ossBaseDir);
          this.finalPrefix = this.config.ossBaseDir;
        } else {
          this.finalPrefix = this.config.ossBaseDir + '/' + this.config.project;
        }
      }
      this.debug('使用的 OSS 目录:', this.finalPrefix);
      return this.finalPrefix;
    }
  }, {
    key: 'uploadFiles',
    value: function uploadFiles(files, compilation) {
      var _this3 = this;

      var i = 1;
      var self = this;
      return _promise2.default.all(_.map(files, function (file) {
        file.$retryTime = 0;
        var uploadName = (_this3.calcPrefix() + '/' + file.name).replace('//', '/');
        if (file.name.indexOf('main') !== -1) {
          console.log(file);
        }

        if (_this3.config.existCheck !== true) {
          return _this3.uploadFile(file, i++, files, compilation, uploadName);
        } else {
          return new _promise2.default(function (resolve, reject) {
            _this3.bucketManager.listPrefix(_this3.config.auth.bucket, {
              prefix: uploadName,
              limit: 50
            }, function (err, respBody, respInfo) {
              if (err) {
                console.log(err);
                self.uploadFile(file, i++, files, compilation, uploadName).then(function () {
                  for (var _len = arguments.length, rest = Array(_len), _key = 0; _key < _len; _key++) {
                    rest[_key] = arguments[_key];
                  }

                  return resolve(rest);
                }).catch(function (err) {
                  return reject(err);
                });
                throw err;
              }
              if (respInfo.statusCode == 200) {
                var arr = respBody.items;
                if (arr && arr.length > 0) {
                  var timeStr = new Date(Number(String(arr[0].putTime).slice(0, String(arr[0].putTime).length - 4)));
                  log(green('已存在,免上传') + ' (\u4E0A\u4F20\u4E8E ' + timeStr + ') ' + ++i + '/' + files.length + ': ' + uploadName);
                  self.config.removeMode && delete compilation.assets[file.name];
                  resolve();
                } else {
                  self.uploadFile(file, i++, files, compilation, uploadName).then(function () {
                    for (var _len2 = arguments.length, rest = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
                      rest[_key2] = arguments[_key2];
                    }

                    return resolve(rest);
                  }).catch(function (err) {
                    return reject(err);
                  });
                }
              } else {
                console.log(respInfo.statusCode);
                console.log(respBody);
              }
            });
          });
        }
      }));
    }
  }, {
    key: 'uploadFile',
    value: function uploadFile(file, idx, files, compilation, uploadName) {
      var _this4 = this;

      return new _promise2.default(function (resolve, reject) {
        var fileCount = files.length;
        getFileContentBuffer(file, _this4.config.gzip).then(function (contentBuffer) {
          console.log(contentBuffer);
          var opt = _this4.getOptions(_this4.config.gzip);
          var self = _this4;
          var _uploadAction = function _uploadAction() {
            file.$retryTime++;
            log('\u5F00\u59CB\u4E0A\u4F20 ' + idx + '/' + fileCount + ': ' + (file.$retryTime > 1 ? '第' + (file.$retryTime - 1) + '次重试' : ''), uploadName);
            var uploadToken = _this4.config.auth.uploadToken;
            var putExtra = _this4.config.auth.putExtra;
            putExtra.mimeType = mime.getType(uploadName);
            _this4.client.put(uploadToken, uploadName, contentBuffer, putExtra, function (respErr, respBody, respInfo) {
              if (respErr) {
                throw respErr;
              }
              if (respInfo.statusCode == 200) {
                log('\u4E0A\u4F20\u6210\u529F ' + idx + '/' + fileCount + ': ' + uploadName);
                _this4.config.removeMode && delete compilation.assets[file.name];
                resolve();
              } else {
                if (file.$retryTime < _this4.config.retry + 1) {
                  _uploadAction();
                } else {
                  reject(err);
                }
              }
            });
          };
          _uploadAction();
        }).catch(function (err) {
          reject(err);
        });
      });
    }
  }, {
    key: 'getOptions',
    value: function getOptions(gzip) {
      var optValid = _.isPlainObject(this.config.options);
      if (gzip) {
        if (optValid) {
          if (!this.config.options.headers) this.config.options.headers = {};
          this.config.options.headers['Content-Encoding'] = 'gzip';
          return this.config.options;
        } else {
          return {
            headers: { 'Content-Encoding': 'gzip' }
          };
        }
      } else {
        return optValid ? this.config.options : undefined;
      }
    }
  }, {
    key: 'pickupAssetsFiles',
    value: function pickupAssetsFiles(compilation) {
      var _this5 = this;

      var matched = {};
      var keys = (0, _keys2.default)(compilation.assets);

      var _loop = function _loop(i) {
        console.log(_this5.config.includeDir);
        var includeFlag = _this5.config.includeDir.length > 0 ? _this5.config.includeDir.find(function (n) {
          return keys[i].startsWith(n);
        }) : true;
        var excludeFlag = _this5.config.exclude.test(keys[i]);
        if (includeFlag && !excludeFlag) matched[keys[i]] = compilation.assets[keys[i]];
      };

      for (var i = 0; i < keys.length; i++) {
        _loop(i);
      }
      return _.map(matched, function (value, name) {
        return {
          name: name,
          path: value.existsAt,
          content: value.source()
        };
      });
    }
  }, {
    key: 'npmProjectName',
    value: function npmProjectName() {
      try {
        var pkg = require(path.resolve(process.env.PWD, 'package.json'));
        return pkg.name;
      } catch (e) {
        return '';
      }
    }
  }, {
    key: 'debug',
    value: function debug() {
      this.config.enableLog && log.apply(undefined, arguments);
    }
  }]);
  return WebpackQINIUOSSPlugin;
}();

function extraEnvBoolean(val) {
  if (val && val === 'true') {
    return true;
  }
  if (val && val === 'false') {
    return false;
  }
}

function getTimeStr(d) {
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate() + ' ' + d.getHours() + ':' + d.getMinutes();
}

function getFileContentBuffer(file, gzipVal) {
  var gzip = typeof gzipVal === 'number' || gzipVal === true ? true : false;
  var opts = typeof gzipVal === 'number' ? { level: gzipVal } : {};
  if (!gzip) return _promise2.default.resolve(Buffer.from(file.content));
  return new _promise2.default(function (resolve, reject) {
    zlib.gzip(Buffer.from(file.content), opts, function (err, gzipBuffer) {
      if (err) reject(err);
      resolve(gzipBuffer);
    });
  });
}

function configMergeCustomizer(objVal, srcVal) {
  if (_.isPlainObject(objVal) && _.isPlainObject(srcVal)) {
    return _.merge(objVal, srcVal);
  } else {
    return srcVal;
  }
}

function log() {
  var _console;

  for (var _len3 = arguments.length, rest = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
    rest[_key3] = arguments[_key3];
  }

  (_console = console).log.apply(_console, [chalk.bgMagenta('[webpack-QINIUOSS-plugin]:')].concat(rest));
}
function warn() {
  var _console2;

  for (var _len4 = arguments.length, rest = Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
    rest[_key4] = arguments[_key4];
  }

  (_console2 = console).warn.apply(_console2, [chalk.bgMagenta('[webpack-QINIUOSS-plugin]:')].concat(rest));
}