// const path = require('path');
// const HtmlWebpackPlugin = require('html-webpack-plugin');
// import { Buffer } from 'buffer';
// import HtmlWebpackPlugin from 'html-webpack-plugin';
const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
module.exports = {
  entry: {
    index: './src/index.ts',
    twitter: './src/ext/twitter.tsx',
    pageScript: './src/pageScript.js',
    inject: './src/inject.js',
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.*css$/,
        exclude: path.resolve('./node_modules/'),
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: { url: false },
          },
          'postcss-loader',
        ],
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    fallback: {
      buffer: require.resolve('buffer/'),
      ethers: require.resolve('ethers'),
    },
  },
  output: {
    filename: '[name].js',
    path: path.resolve('dist'),
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html',
    }),
    new MiniCssExtractPlugin(),
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      ethers: ['ethers'],
    }),
    new CopyPlugin({
      patterns: [
        {
          from: path.resolve('manifest.json'),
          to: path.resolve('dist'),
        },
      ],
    }),
  ],
  devServer: {
    static: {
      directory: path.resolve('dist'),
    },
    compress: true,
    port: 9000,
  },
};
