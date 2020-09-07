import * as elliptic from "elliptic";
import {
    ContractManagerInstance,
    ConstantsHolderInstance,
    BountyInstance,
    DistributorInstance,
    NodesInstance,
    SkaleManagerInstance,
    SkaleTokenInstance,
    ValidatorServiceInstance,
} from "../types/truffle-contracts";

const EC = elliptic.ec;
const ec = new EC("secp256k1");

import { privateKeys } from "./tools/private-keys";

import { deployContractManager } from "./tools/deploy/contractManager";
import { deployConstantsHolder } from "./tools/deploy/constantsHolder";
import { deploySkaleManager } from "./tools/deploy/skaleManager";
import { deploySkaleToken } from "./tools/deploy/skaleToken";
import { deployValidatorService } from "./tools/deploy/delegation/validatorService";
import { deployNodes } from "./tools/deploy/nodes";
import { deployBounty } from "./tools/deploy/bounty";
import { deployDistributor } from "./tools/deploy/delegation/distributor";
import { skipTime, currentTime } from "./tools/time";
import * as chaiAsPromised from "chai-as-promised";
import * as chai from "chai";

chai.should();
chai.use(chaiAsPromised);

contract("Bounty", ([owner, admin, hacker, validator]) => {
    let contractManager: ContractManagerInstance;
    let constantsHolder: ConstantsHolderInstance;
    let skaleManager: SkaleManagerInstance;
    let skaleToken: SkaleTokenInstance;
    let validatorService: ValidatorServiceInstance;
    let bountyContract: BountyInstance;
    let distributor: DistributorInstance;
    let nodesContract: NodesInstance;

    let validator1Id = 0;

    beforeEach(async () => {
        contractManager = await deployContractManager();
        constantsHolder = await deployConstantsHolder(contractManager);
        skaleManager = await deploySkaleManager(contractManager);
        skaleToken = await deploySkaleToken(contractManager);
        validatorService = await deployValidatorService(contractManager);
        bountyContract = await deployBounty(contractManager);
        nodesContract = await deployNodes(contractManager);
        distributor = await deployDistributor(contractManager);

        await skaleManager.grantRole(await skaleManager.ADMIN_ROLE(), admin);
        const bountyPoolSize = "2310000000" + "0".repeat(18);
        await skaleToken.mint(skaleManager.address, bountyPoolSize, "0x", "0x");
        await validatorService.registerValidator("Validator1", "D2 is even", 0, 0, {from: validator});
        validator1Id = (await validatorService.getValidatorId(validator)).toNumber();
        await validatorService.enableValidator(validator1Id, {from: owner});
        await constantsHolder.setLaunchTimestamp((await currentTime(web3)));
        await constantsHolder.setPeriods(2592000, 3600, {from: owner});
    });

    it("should allow only owner to call enableBountyReduction", async() => {
        await bountyContract.enableBountyReduction({from: hacker})
            .should.be.eventually.rejectedWith("Caller is not the owner");
        await bountyContract.enableBountyReduction({from: admin})
            .should.be.eventually.rejectedWith("Caller is not the owner");
        await bountyContract.enableBountyReduction({from: owner});
    });

    it("should allow only owner to call disableBountyReduction", async() => {
        await bountyContract.disableBountyReduction({from: hacker})
            .should.be.eventually.rejectedWith("Caller is not the owner");
        await bountyContract.disableBountyReduction({from: admin})
            .should.be.eventually.rejectedWith("Caller is not the owner");
        await bountyContract.disableBountyReduction({from: owner});
    });

    describe("when 10 nodes registered", async() => {
        const rewardPeriod = 60 * 60 * 24 * 30 + 60 * 60;

        beforeEach(async() => {
            const nodesCount = 10;
            for (const index of Array.from(Array(nodesCount).keys())) {
                const hexIndex = ("0" + index.toString(16)).slice(-2);
                const privateKey: string = String(privateKeys[3]);
                console.log(privateKey);
                console.log(ec);
                const pubKey = ec.keyFromPrivate(privateKey).getPublic('hex');
                console.log(pubKey);
                console.log("0x" + pubKey.slice(32), "0x" + pubKey.slice(33, 64));
                await nodesContract.createNode(validator,
                    {
                        port: 8545,
                        nonce: 0,
                        ip: "0x7f0000" + hexIndex,
                        publicIp: "0x7f0000" + hexIndex,
                        publicKey: ["0x" + pubKey.getX('hex'), "0x" + pubKey.getY('hex')],
                        // "0x1122334455667788990011223344556677889900112233445566778899001122"],
                        name: "d2" + hexIndex
                    });
            }
        });
        04219f2ae658cd9971c853e36df8ca6721924487f4d375b8944b549b9e707051ffe76826be6c4d02b959453dac3eb45e56f3334ca04a930170e1416fefe5a8e91c
        // 0x15207548770033912924190699228234554789106459798809276107850447879998649946623

        it("should get bounty after reward period", async() => {
            await skaleManager.getBounty(0, {from: validator}).should.be.eventually.rejectedWith("Not time for bounty");
            skipTime(web3, rewardPeriod);
            const balanceBefore = await skaleToken.balanceOf(validator);
            console.log("Balance:", balanceBefore.toString());
            await skaleManager.getBounty(0, {from: validator});
            console.log("Start");
            // await distributor.withdrawBounty(validator1Id, validator, {from: validator});
            const balanceAfter = await skaleToken.balanceOf(validator);
            console.log("Balance after:", balanceAfter.toString());
        });

        it("5 year test for 10 nodes", async() => {
            for (let month = 0; month < 24; month++) {
                skipTime(web3, rewardPeriod);

                for (let nodeIndex = 0; nodeIndex < 10; nodeIndex++) {
                    console.log("should " + nodeIndex + " node get bounty after " + month + " month ");
                    const time = await currentTime(web3);
                    const currentDate = new Date(time * 1000);
                    console.log(currentDate.toString());
                    const balanceBefore = await skaleToken.balanceOf(validator);
                    console.log("Balance:", balanceBefore.toString());
                    await skaleManager.getBounty(nodeIndex, {from: validator});
                    console.log("Start");
                    // await distributor.withdrawBounty(0, validator, {from: validator});
                    const balanceAfter = await skaleToken.balanceOf(validator);
                    console.log("Balance after:", balanceAfter.toString());
                }
            }
        });
    });
});
