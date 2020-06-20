import BigNumber from "bignumber.js";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";

import { ContractManagerInstance,
         NodesInstance,
         PricingInstance,
         SchainsInternalInstance,
         ValidatorServiceInstance} from "../types/truffle-contracts";

import { deployContractManager } from "./tools/deploy/contractManager";
import { deployNodes } from "./tools/deploy/nodes";
import { deployPricing } from "./tools/deploy/pricing";
import { deploySchainsInternal } from "./tools/deploy/schainsInternal";
import { skipTime } from "./tools/time";
import { deployValidatorService } from "./tools/deploy/delegation/validatorService";

chai.should();
chai.use(chaiAsPromised);

contract("Pricing", ([owner, holder, validator, nodeAddress]) => {
    let contractManager: ContractManagerInstance;
    let pricing: PricingInstance;
    let schainsInternal: SchainsInternalInstance;
    let nodes: NodesInstance;
    let validatorService: ValidatorServiceInstance;

    beforeEach(async () => {
        contractManager = await deployContractManager();

        nodes = await deployNodes(contractManager);
        schainsInternal = await deploySchainsInternal(contractManager);
        pricing = await deployPricing(contractManager);
        validatorService = await deployValidatorService(contractManager);

        await validatorService.registerValidator("Validator", "D2", 0, 0, {from: validator});
        const validatorIndex = await validatorService.getValidatorId(validator);
        let signature1 = await web3.eth.sign(web3.utils.soliditySha3(validatorIndex.toString()), nodeAddress);
        signature1 = (signature1.slice(130) === "00" ? signature1.slice(0, 130) + "1b" :
                (signature1.slice(130) === "01" ? signature1.slice(0, 130) + "1c" : signature1));
        await validatorService.linkNodeAddress(nodeAddress, signature1, {from: validator});
    });

    describe("on initialized contracts", async () => {
        beforeEach(async () => {
            await schainsInternal.initializeSchain("BobSchain", holder, 10, 2);
            await schainsInternal.initializeSchain("DavidSchain", holder, 10, 4);
            await schainsInternal.initializeSchain("JacobSchain", holder, 10, 8);
            await nodes.createNode(
                nodeAddress,
                {
                    port: 8545,
                    nonce: 0,
                    ip: "0x7f000001",
                    publicIp: "0x7f000001",
                    publicKey: ["0x1122334455667788990011223344556677889900112233445566778899001122",
                                "0x1122334455667788990011223344556677889900112233445566778899001122"],
                    name: "elvis1"
                });

            await nodes.createNode(
                nodeAddress,
                {
                    port: 8545,
                    nonce: 0,
                    ip: "0x7f000003",
                    publicIp: "0x7f000003",
                    publicKey: ["0x1122334455667788990011223344556677889900112233445566778899001122",
                                "0x1122334455667788990011223344556677889900112233445566778899001122"],
                    name: "elvis2"
                });

            await nodes.createNode(
                nodeAddress,
                {
                    port: 8545,
                    nonce: 0,
                    ip: "0x7f000005",
                    publicIp: "0x7f000005",
                    publicKey: ["0x1122334455667788990011223344556677889900112233445566778899001122",
                                "0x1122334455667788990011223344556677889900112233445566778899001122"],
                    name: "elvis3"
                });

            await nodes.createNode(
                nodeAddress,
                {
                    port: 8545,
                    nonce: 0,
                    ip: "0x7f000007",
                    publicIp: "0x7f000007",
                    publicKey: ["0x1122334455667788990011223344556677889900112233445566778899001122",
                                "0x1122334455667788990011223344556677889900112233445566778899001122"],
                    name: "elvis4"
                });

        });

        it("should increase number of schains", async () => {
            const numberOfSchains = new BigNumber(await schainsInternal.numberOfSchains());
            assert(numberOfSchains.isEqualTo(3));
        });

        it("should increase number of nodes", async () => {
            const numberOfNodes = new BigNumber(await nodes.getNumberOfNodes());
            assert(numberOfNodes.isEqualTo(4));
        });

        describe("on existing nodes and schains", async () => {
            const bobSchainHash = web3.utils.soliditySha3("BobSchain");
            const davidSchainHash = web3.utils.soliditySha3("DavidSchain");
            const jacobSchainHash = web3.utils.soliditySha3("JacobSchain");

            const johnNodeHash = web3.utils.soliditySha3("John");
            const michaelNodeHash = web3.utils.soliditySha3("Michael");
            const danielNodeHash = web3.utils.soliditySha3("Daniel");
            const stevenNodeHash = web3.utils.soliditySha3("Steven");

            beforeEach(async () => {

                await schainsInternal.createGroupForSchain(bobSchainHash, 1, 4);
                await schainsInternal.createGroupForSchain(davidSchainHash, 1, 4);
                await schainsInternal.createGroupForSchain(jacobSchainHash, 2, 1);

            });

            it("should check load percentage of network", async () => {
                const numberOfNodes = new BigNumber(await nodes.getNumberOfNodes()).toNumber();
                let sumNode = 0;
                for (let i = 0; i < numberOfNodes; i++) {
                    const getSchainIdsForNode = await schainsInternal.getSchainIdsForNode(i);
                    for (const schain of getSchainIdsForNode) {
                        const partOfNode = new BigNumber(await schainsInternal.getSchainsPartOfNode(schain)).toNumber();
                        const isNodeLeft = await nodes.isNodeLeft(i);
                        if (partOfNode !== 0  && !isNodeLeft) {
                            sumNode += 128 / partOfNode;
                        }
                    }
                }
                const newLoadPercentage = Math.floor((sumNode * 100) / (128 * numberOfNodes));
                const loadPercentage = new BigNumber(await pricing.getTotalLoadPercentage()).toNumber();
                newLoadPercentage.should.be.equal(loadPercentage);
            });

            it("should check total number of nodes", async () => {
                await pricing.initNodes();
                const totalNodes = new BigNumber(await pricing.totalNodes());
                assert(totalNodes.isEqualTo(4));
            });

            it("should not change price when no any new nodes have been added", async () => {
                await pricing.initNodes();
                skipTime(web3, 61);
                await pricing.adjustPrice()
                    .should.be.eventually.rejectedWith("No any changes on nodes");
            });

            it("should not change price when the price is updated more often than necessary", async () => {
                await pricing.initNodes();
                await pricing.adjustPrice()
                    .should.be.eventually.rejectedWith("It's not a time to update a price");
            });

            it("should rejected if price - priceChange overflowed price", async () => {
                await nodes.createNode(
                    nodeAddress,
                    {
                        port: 8545,
                        nonce: 0,
                        ip: "0x7f000010",
                        publicIp: "0x7f000011",
                        publicKey: ["0x1122334455667788990011223344556677889900112233445566778899001122",
                                    "0x1122334455667788990011223344556677889900112233445566778899001122"],
                        name: "vadim"
                    });
                skipTime(web3, 10 ** 6);
                await pricing.adjustPrice()
                    .should.be.eventually.rejectedWith("SafeMath: subtraction overflow");
            });

            describe("change price when changing the number of nodes", async () => {
                let oldPrice: number;

                beforeEach(async () => {
                    await pricing.initNodes();
                    oldPrice = new BigNumber(await pricing.price()).toNumber();
                });

                async function getPrice(MINUTES_PASSED: number) {
                    const MIN_PRICE = new BigNumber(await pricing.MIN_PRICE()).toNumber();
                    const ADJUSTMENT_SPEED = new BigNumber(await pricing.ADJUSTMENT_SPEED()).toNumber();
                    const OPTIMAL_LOAD_PERCENTAGE = new BigNumber(await pricing.OPTIMAL_LOAD_PERCENTAGE()).toNumber();
                    const COOLDOWN_TIME = new BigNumber(await pricing.COOLDOWN_TIME()).toNumber();
                    skipTime(web3, MINUTES_PASSED * COOLDOWN_TIME);
                    await pricing.adjustPrice();

                    const loadPercentage = new BigNumber(await pricing.getTotalLoadPercentage()).toNumber();
                    let priceChange: number;
                    if (loadPercentage < OPTIMAL_LOAD_PERCENTAGE) {
                        priceChange = (-1) * (ADJUSTMENT_SPEED * oldPrice)
                                      * (OPTIMAL_LOAD_PERCENTAGE - loadPercentage) / 10 ** 6;
                    } else {
                        priceChange = (ADJUSTMENT_SPEED * oldPrice)
                                      * (loadPercentage - OPTIMAL_LOAD_PERCENTAGE) / 10 ** 6;
                    }
                    let price = oldPrice + priceChange * MINUTES_PASSED;
                    if (price < MIN_PRICE) {
                        price = MIN_PRICE;
                    }
                    return price;
                }

                it("should change price when new active node has been added", async () => {
                    await nodes.createNode(
                        nodeAddress,
                        {
                            port: 8545,
                            nonce: 0,
                            ip: "0x7f000010",
                            publicIp: "0x7f000011",
                            publicKey: ["0x1122334455667788990011223344556677889900112233445566778899001122",
                                        "0x1122334455667788990011223344556677889900112233445566778899001122"],
                            name: "vadim"
                        });
                    const MINUTES_PASSED = 2;
                    const price = await getPrice(MINUTES_PASSED);
                    const newPrice = new BigNumber(await pricing.price()).toNumber();
                    price.should.be.equal(newPrice);
                    oldPrice.should.be.above(price);
                });

                it("should change price when active node has been removed", async () => {
                    await nodes.initExit(0);
                    await nodes.completeExit(0);
                    const MINUTES_PASSED = 2;
                    const price = await getPrice(MINUTES_PASSED);
                    const newPrice = new BigNumber(await pricing.price()).toNumber();
                    price.should.be.equal(newPrice);
                    price.should.be.above(oldPrice);
                });

                it("should set price to min of too many minutes passed and price is less than min", async () => {
                    await nodes.createNode(
                        nodeAddress,
                        {
                            port: 8545,
                            nonce: 0,
                            ip: "0x7f000010",
                            publicIp: "0x7f000011",
                            publicKey: ["0x1122334455667788990011223344556677889900112233445566778899001122",
                                        "0x1122334455667788990011223344556677889900112233445566778899001122"],
                            name: "vadim"
                        });
                    const MINUTES_PASSED = 30;
                    const price = await getPrice(MINUTES_PASSED);
                    const MIN_PRICE = new BigNumber(await pricing.MIN_PRICE()).toNumber();
                    price.should.be.equal(MIN_PRICE);
                });
            });
        });
    });
});
