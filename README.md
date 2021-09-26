# qiniu-webpack5-plugin
七牛OSS & 前端工程化上传插件，在 webpack 打包完成后自动上传至七牛云对象存储。
> 基于[borenXue/webpack-alioss-plugin](https://github.com/borenXue/webpack-alioss-plugin)改造
理论上支持 webpack 3、4、5（3 和 4 待验证）

# 安装
```
npm install -D qiniu-webpack5-plugin
```

# 使用
### 环境变量配置（推荐）
在 CI 、env 或其他环境环境中加入以下环境变量：
```
WEBPACK_QINIUOSS_PLUGIN_ACCESS_KEY_ID 对应配置项 accessKeyId
WEBPACK_QINIUOSS_PLUGIN_ACCESS_KEY_SECRET 对应配置项 accessKeySecret
WEBPACK_QINIUOSS_PLUGIN_BUCKET 对应配置项 bucket
WEBPACK_QINIUOSS_PLUGIN_REGION 对应配置项 region
(可选, 默认为 'auto_upload_ci') WEBPACK_QINIUOSS_PLUGIN_OSS_BASE_DIR 对应配置项 ossBaseDir
```
在 webpack 中直接使用即可
```
const QINIUOSS = require('qiniu-webpack5-plugin')
webpackConfig.plugins.push(new QINIUOSSPlugin())
```
### 导入配置
```
const QINIUOSS = require('qiniu-webpack5-plugin')

webpackConfig.plugins.push(new AliOSSPlugin({
  auth: {
    accessKeyId: '', // 七牛管理控制台获取
    accessKeySecret: '', // 七牛管理控制台获取
    region: 'oss-cn-hangzhou', // OSS 服务节点, 详见：https://developer.qiniu.com/kodo/1289/nodejs
    bucket: 'abc', // OSS 存储空间名称
  },
  ossBaseDir: '',
}))
```

### 配置项
构造参数 | 环境变量 | 默认值 | 说明 |
---  | --- | --- | --- |
accessKeyId | `WEBPACK_ALIOSS_PLUGIN_ACCESS_KEY_ID` | 空 | OSS 访问 key |
accessKeySecret | `WEBPACK_ALIOSS_PLUGIN_ACCESS_KEY_SECRET` | 空 | OSS 访问 secret |
bucket | `WEBPACK_ALIOSS_PLUGIN_BUCKET` | 空 | OSS 存储空间 |
region | `WEBPACK_ALIOSS_PLUGIN_REGION` | 空 | OSS 服务节点 |
exclude | - | `/.*\.html$/` | 即匹配该正则的文件名 不会被上传到 OSS |
includeDir | - | ['static', 'public/css'] | 可上传的文件夹，当配置此项后，只有目标文件夹内的文件才会被上传。 |
retry | - | 3 | 上传失败后重试次数, 0 代表不重试 |
gzip | - | `false` | 是否在上传前进行 gzip 压缩 |
existCheck | - | `true` | 上传前是否先检测已存在(已存在则不重复上传, 不存在才进行上传) |
enableLog | `WEBPACK_ALIOSS_PLUGIN_ENABLE_LOG` | false | 是否输出详细的日志信息 |
ignoreError | `WEBPACK_ALIOSS_PLUGIN_IGNORE_ERROR` | false | 上传过程中出现错误是否继续 webpack 构建 |
removeMode | `WEBPACK_ALIOSS_PLUGIN_REMOVE_MODE` | true | 生成的文件自动上传至 OSS 后, 是否删除本地的对应文件 |
ossBaseDir | `WEBPACK_ALIOSS_PLUGIN_OSS_BASE_DIR` | `auto_upload_ci` | OSS 中存放上传文件的一级目录名 |
project | - | 默认会自动读取 `package.json` 中的 `name` | OSS 中存放上传文件的二级目录, 一般为项目名 |
options | - | undefined | 对象类型. [可用于设置文件的请求头、超时时间等](https://github.com/ali-sdk/ali-oss#putname-file-options) |
envPrefix | - | `''` | 字符串类型. 环境变量key的前缀(针对所有相关的环境变量) |