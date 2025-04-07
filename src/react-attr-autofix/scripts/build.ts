import webpack from 'webpack';
import path from 'path';
import { fileURLToPath } from 'url';
import nodeExternals from 'webpack-node-externals';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const entryPath = path.resolve(__dirname, '../index.ts');

// 确保输出目录存在
const ensureDirectoryExistence = (dirPath: string) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

// 在构建之前清理输出目录中的旧文件
const cleanOutputDirectory = (dirPath: string) => {
    if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
            const filePath = path.join(dirPath, file);
            if (fs.statSync(filePath).isFile()) {
                fs.unlinkSync(filePath);
            } else {
                fs.rmSync(filePath, { recursive: true, force: true });
            }
        }
    }
};

// 定义webpack配置
const webpackConfig: webpack.Configuration = {
    mode: 'production',
    entry: entryPath,
    target: 'node',
    externals: [nodeExternals({
        allowlist: ['escodegen']
    })],
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'index.cjs',
        globalObject: 'this',
        library: {
            type: 'commonjs2',
            export: 'default'
        },
    },
    resolve: {
        extensions: ['.ts', '.js'],
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: [
                            ['@babel/preset-env', { targets: { node: 'current' } }],
                            '@babel/preset-typescript'
                        ],
                        plugins: [
                            '@babel/plugin-transform-runtime',
                            '@babel/plugin-proposal-class-properties',
                            '@babel/plugin-proposal-object-rest-spread'
                        ]
                    }
                }
            }
        ]
    }
};

// 准备输出目录
const outputDir = path.resolve(__dirname, 'dist');
ensureDirectoryExistence(outputDir);
cleanOutputDirectory(outputDir);

// 运行webpack
const compiler = webpack(webpackConfig);

// 执行编译
compiler.run((err, stats) => {
    if (err) {
        console.error('❌ webpack编译错误:', err.stack || err);
        if (err) {
            console.error('❌ 错误详情:', err);
        }
        process.exit(1);
    }

    const info = stats?.toJson();

    if (stats?.hasErrors()) {
        console.error('❌ 构建错误:');
        if (info?.errors) {
            info.errors.forEach(error => {
                console.error(error.message);
            });
        }
        process.exit(1);
    }

    if (stats?.hasWarnings()) {
        console.warn('⚠️ 构建警告:');
        if (info?.warnings) {
            info.warnings.forEach(warning => {
                console.warn(warning.message);
            });
        }
    }

    // 输出编译信息
    console.log(`✅ 构建完成! 耗时: ${stats?.endTime! - stats?.startTime!}ms`);
    console.log(`📦 输出目录: ${outputDir}`);

    // 显示资源大小信息
    if (info?.assets) {
        console.log('📊 输出资源:');
        info.assets.forEach(asset => {
            console.log(`   ${asset.name}: ${(asset.size / 1024).toFixed(2)} KB`);
        });
    }

    // 关闭编译器
    compiler.close((closeErr) => {
        if (closeErr) {
            console.error('❌ 关闭编译器时出错:', closeErr);
        }
    });
});