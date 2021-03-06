import { BigNumber } from "ethers";
import chaiAsPromised from "chai-as-promised";
import { ConstantsHolder,
         ContractManager } from "../typechain";
import { skipTime } from "./tools/time";

import chai = require("chai");
import { deployConstantsHolder } from "./tools/deploy/constantsHolder";
import { deployContractManager } from "./tools/deploy/contractManager";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { solidity } from "ethereum-waffle";

chai.should();
chai.use(chaiAsPromised);
chai.use(solidity);

describe("ConstantsHolder", () => {
  let user: SignerWithAddress;

  let contractManager: ContractManager;
  let constantsHolder: ConstantsHolder;

  before(async () => {
    [, user] = await ethers.getSigners();

    contractManager = await deployContractManager();
    constantsHolder = await deployConstantsHolder(contractManager);
  });

  it("NODE_DEPOSIT should be equal 100000000000000000000", async () => {
    (await constantsHolder.NODE_DEPOSIT()).should.be.equal("100000000000000000000");
  });

  it("SMALL_DIVISOR should be equal 128", async () => {
    (await constantsHolder.SMALL_DIVISOR()).should.be.equal(128);
  });

  it("MEDIUM_DIVISOR should be equal 32", async () => {
    (await constantsHolder.MEDIUM_DIVISOR()).should.be.equal(32);
  });

  it("LARGE_DIVISOR should be equal 1", async () => {
    (await constantsHolder.LARGE_DIVISOR()).should.be.equal(1);
  });

  it("MEDIUM_TEST_DIVISOR should be equal 4", async () => {
    (await constantsHolder.MEDIUM_TEST_DIVISOR()).should.be.equal(4);
  });

  it("NUMBER_OF_NODES_FOR_SCHAIN should be equal 16", async () => {
    (await constantsHolder.NUMBER_OF_NODES_FOR_SCHAIN()).should.be.equal(16);
  });

  it("NUMBER_OF_NODES_FOR_TEST_SCHAIN should be equal 2", async () => {
    (await constantsHolder.NUMBER_OF_NODES_FOR_TEST_SCHAIN()).should.be.equal(2);
  });

  it("NUMBER_OF_NODES_FOR_MEDIUM_TEST_SCHAIN should be equal 4", async () => {
    (await constantsHolder.NUMBER_OF_NODES_FOR_MEDIUM_TEST_SCHAIN()).should.be.equal(4);
  });

  it("SECONDS_TO_YEAR should be equal 31622400", async () => {
    (await constantsHolder.SECONDS_TO_YEAR()).should.be.equal(31622400);
  });

  it("NUMBER_OF_MONITORS should be equal 24", async () => {
    (await constantsHolder.NUMBER_OF_MONITORS()).should.be.equal(24);
  });

  it("rewardPeriod should be 30 days", async () => {
    (await constantsHolder.rewardPeriod()).should.be.equal(60 * 60 * 24 * 30);
  });

  it("deltaPeriod should be 1 hour", async () => {
    (await constantsHolder.deltaPeriod()).should.be.equal(60 * 60);
  });

  it("checkTime should be equal 5 minutes", async () => {
    (await constantsHolder.checkTime()).should.be.equal(5 * 60);
  });

  it("should invoke setPeriods function and change rewardPeriod and deltaPeriod", async () => {
    await constantsHolder.setPeriods(5555, 333);
    (await constantsHolder.rewardPeriod()).should.be.equal(5555);
    (await constantsHolder.deltaPeriod()).should.be.equal(333);
  });

  it("should Set latency", async () => {
    const miliSec = 100;
    await constantsHolder.connect(user).setLatency(miliSec)
      .should.be.eventually.rejectedWith("Caller is not the owner");
    await constantsHolder.setLatency(miliSec);
    (await constantsHolder.allowableLatency()).should.be.equal(miliSec);
  });

  it("should Set checkTime", async () => {
    const sec = 240;
    await constantsHolder.connect(user).setCheckTime(sec)
      .should.be.eventually.rejectedWith("Caller is not the owner");
    await constantsHolder.setCheckTime(sec);
    (await constantsHolder.checkTime()).should.be.equal(sec);
  });

  it("should set rotation delay", async () => {
    await constantsHolder.connect(user).setRotationDelay(13)
      .should.be.eventually.rejectedWith("Caller is not the owner");
    await constantsHolder.setRotationDelay(13);
    (await constantsHolder.rotationDelay()).toNumber()
      .should.be.equal(13);
  });

  it("should set proof-of-use lockup period", async () => {
    await constantsHolder.setProofOfUseLockUpPeriod(13);
    (await constantsHolder.proofOfUseLockUpPeriodDays()).toNumber()
      .should.be.equal(13);
  });

  it("should set proof-of-use delegation percentage", async () => {
    await constantsHolder.setProofOfUseDelegationPercentage(13);
    (await constantsHolder.proofOfUseDelegationPercentage()).toNumber()
      .should.be.equal(13);
  });

  it("should set MSR", async () => {
    const msr = 100;
    await constantsHolder.connect(user).setMSR(msr)
      .should.be.eventually.rejectedWith("Caller is not the owner");
    await constantsHolder.setMSR(msr);
    (await constantsHolder.msr()).should.be.equal(msr);
  });

  it("should set launch timestamp", async () => {
    const launch = 100;
    await constantsHolder.connect(user).setLaunchTimestamp(launch)
      .should.be.eventually.rejectedWith("Caller is not the owner");
    await constantsHolder.setLaunchTimestamp(launch);
    (await constantsHolder.launchTimestamp()).should.be.equal(launch);
  });

  it("should set PoU delegation percentage", async () => {
    const percentage = 100;
    await constantsHolder.connect(user).setProofOfUseDelegationPercentage(percentage)
      .should.be.eventually.rejectedWith("Caller is not the owner");
    await constantsHolder.setProofOfUseDelegationPercentage(percentage);
    (await constantsHolder.proofOfUseDelegationPercentage()).should.be.equal(percentage);
  });

  it("should set PoU delegation time", async () => {
    const period = 180;
    await constantsHolder.connect(user).setProofOfUseLockUpPeriod(period)
      .should.be.eventually.rejectedWith("Caller is not the owner");
    await constantsHolder.setProofOfUseLockUpPeriod(period);
    (await constantsHolder.proofOfUseLockUpPeriodDays()).should.be.equal(period);
  });

  it("should set limit of validators per delegators", async () => {
    const newLimit = 30;
    await constantsHolder.connect(user).setLimitValidatorsPerDelegator(newLimit)
      .should.be.eventually.rejectedWith("Caller is not the owner");

    await constantsHolder.setLimitValidatorsPerDelegator(newLimit);
    (await constantsHolder.limitValidatorsPerDelegator()).should.be.equal(newLimit);
  });

  it("should set schain creation timestamp", async () => {
    const timeStamp = 100;
    await constantsHolder.connect(user).setSchainCreationTimeStamp(timeStamp)
      .should.be.eventually.rejectedWith("Caller is not the owner");
    await constantsHolder.setSchainCreationTimeStamp(timeStamp);
    (await constantsHolder.schainCreationTimeStamp()).should.be.equal(timeStamp);
  });

  it("should set minimal schain lifetime", async () => {
    const lifetime = 100;
    await constantsHolder.connect(user).setMinimalSchainLifetime(lifetime)
      .should.be.eventually.rejectedWith("Caller is not the owner");
    await constantsHolder.setMinimalSchainLifetime(lifetime);
    (await constantsHolder.minimalSchainLifetime()).should.be.equal(lifetime);
  });

  it("should set complaint timelimit", async () => {
    const timelimit = 3600;
    await constantsHolder.connect(user).setComplaintTimelimit(timelimit)
      .should.be.eventually.rejectedWith("Caller is not the owner");
    await constantsHolder.setComplaintTimelimit(timelimit);
    (await constantsHolder.complaintTimelimit()).should.be.equal(timelimit);
  });

});
