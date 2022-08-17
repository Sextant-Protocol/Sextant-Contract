import { ethers } from "hardhat";
import { BigNumber } from "ethers";

async function advanceBlock() {
  return ethers.provider.send("evm_mine", [])
}

async function advanceBlockTo(blockNumber: number) {
  for (let i = await ethers.provider.getBlockNumber(); i < blockNumber; i++) {
    await advanceBlock()
  }
}

async function increase(value: BigNumber) {
  await ethers.provider.send("evm_increaseTime", [value.toNumber()])
  await advanceBlock()
}

async function latestTime() {
  const block = await ethers.provider.getBlock("latest")
  return BigNumber.from(block.timestamp)
  //return getDate(block.timestamp*1000)
}

async function latestDate() {
  const block = await ethers.provider.getBlock("latest")
  return getDate(block.timestamp*1000)
}

async function getDate(timestamp: number) {
  let date = new Date(timestamp);
  let Y = date.getFullYear() + '-';
  let  M = (date.getMonth()+1 < 10 ? '0'+(date.getMonth()+1) : date.getMonth()+1) + '-';
  let D = date.getDate() + ' ';
  let h = date.getHours() + ':';
  let m = date.getMinutes() + ':';
  let s = date.getSeconds();

  return Y+M+D+h+m+s
}

async function latestBlock() {
  const block = await ethers.provider.getBlock("latest")
  return block.number
  //return block
}

async function latestBlockInfo() {
  const block = await ethers.provider.getBlock("latest")
  return block
}

async function advanceTimeAndBlock(time: number) {
  await advanceTime(time)
  await advanceBlock()
  //console.log("=====passed",time.toString(),"seconds")
}

async function advanceTime(time: number) {
  await ethers.provider.send("evm_increaseTime", [time])
}

const duration = {
  seconds: function (val: number) {
    return BigNumber.from(val)
  },
  minutes: function (val: number) {
    return BigNumber.from(val).mul(this.seconds(60))
  },
  hours: function (val: number) {
    return BigNumber.from(val).mul(this.minutes(60))
  },
  days: function (val: number) {
    return BigNumber.from(val).mul(this.hours(24))
  },
  weeks: function (val: number) {
    return BigNumber.from(val).mul(this.days(7))
  },
  years: function (val: number) {
    return BigNumber.from(val).mul(this.days(365))
  },
}

export {
  advanceBlock,
  advanceBlockTo,
  duration,
  latestTime,
  latestDate,
  latestBlock,
  latestBlockInfo,
  increase,
  advanceTime,
  advanceTimeAndBlock,
  getDate,
}
