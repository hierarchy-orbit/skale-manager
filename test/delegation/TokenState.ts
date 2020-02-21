import { ContractManagerInstance,
         DelegationControllerInstance,
         DelegationServiceInstance,
         SkaleTokenInstance,
         TokenStateInstance,
         ValidatorServiceInstance} from "../../types/truffle-contracts";

import { deployContractManager } from "../utils/deploy/contractManager";
import { currentTime, skipTime } from "../utils/time";

import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { deployDelegationController } from "../utils/deploy/delegation/delegationController";
import { deployDelegationService } from "../utils/deploy/delegation/delegationService";
import { deployTokenState } from "../utils/deploy/delegation/tokenState";
import { deployValidatorService } from "../utils/deploy/delegation/validatorService";
import { deploySkaleToken } from "../utils/deploy/skaleToken";
import { State } from "../utils/types";
chai.should();
chai.use(chaiAsPromised);

contract("TokenState", ([owner, holder, validator]) => {
    let contractManager: ContractManagerInstance;
    let delegationController: DelegationControllerInstance;
    let tokenState: TokenStateInstance;
    let validatorService: ValidatorServiceInstance;
    let delegationService: DelegationServiceInstance;
    let skaleToken: SkaleTokenInstance;

    let validatorId: number;
    const month = 60 * 60 * 24 * 31;

    beforeEach(async () => {
        contractManager = await deployContractManager();
        delegationController = await deployDelegationController(contractManager);
        tokenState = await deployTokenState(contractManager);
        validatorService = await deployValidatorService(contractManager);
        delegationService = await deployDelegationService(contractManager);
        skaleToken = await deploySkaleToken(contractManager);

        await delegationService.registerValidator("Validator", "D2 is even", 150, 0, {from: validator});
        validatorId = 1;
        await validatorService.enableValidator(validatorId, {from: owner});
        await skaleToken.mint(owner, holder, 1000, "0x", "0x");
    });

    it("should not lock tokens by default", async () => {
        (await delegationController.calculateLockedAmount.call(holder)).toNumber().should.be.equal(0);
        (await delegationController.calculateDelegatedAmount.call(holder)).toNumber().should.be.equal(0);
    });

    it("should be in `proposed` state after delegation request is sent", async () => {
        // create delegation with id "0"
        const amount = 100;
        await delegationController.delegate(validatorId, amount, 3, "INFO", {from: holder});
        const delegationId = 0;

        const returnedState = await delegationController.getState(delegationId);
        returnedState.toNumber().should.be.equal(State.PROPOSED);
    });

    it("should automatically unlock tokens after delegation request if validator don't accept", async () => {
        const amount = 100;

        await delegationController.delegate(validatorId, amount, 3, "INFO", {from: holder});
        const delegationId = 0;

        skipTime(web3, month);

        const state = await delegationController.getState(delegationId);
        state.toNumber().should.be.equal(State.REJECTED);
        const locked = await delegationController.calculateLockedAmount.call(holder);
        locked.toNumber().should.be.equal(0);
        const delegated = await delegationController.calculateDelegatedAmount.call(holder);
        delegated.toNumber().should.be.equal(0);
    });

    it("should allow holder to cancel delegation before acceptance", async () => {
        const amount = 100;
        await delegationController.delegate(validatorId, amount, 3, "INFO", {from: holder});
        const delegationId = 0;

        let locked = await delegationController.calculateLockedAmount.call(holder);
        locked.toNumber().should.be.equal(amount);
        let delegated = await delegationController.calculateDelegatedAmount.call(holder);
        delegated.toNumber().should.be.equal(0);

        await delegationController.cancelPendingDelegation(delegationId, {from: holder});

        const state = await delegationController.getState(delegationId);
        state.toNumber().should.be.equal(State.CANCELED);
        locked = await delegationController.calculateLockedAmount.call(holder);
        locked.toNumber().should.be.equal(0);
        delegated = await delegationController.calculateDelegatedAmount.call(holder);
        delegated.toNumber().should.be.equal(0);
    });

//     it("should allow to move delegation from proposed to accepted state", async () => {
//         const amount = 100;
//         const time = await currentTime(web3);
//         await delegationController.addDelegation(holder, "5", amount.toString(), "3", time, "INFO");
//         const delegationId = 0;

//         await tokenState.accept(delegationId);

//         const state = await tokenState.getState.call(delegationId);
//         state.toNumber().should.be.equal(State.ACCEPTED);
//         const locked = await tokenState.getLockedCount.call(holder);
//         locked.toNumber().should.be.equal(amount);
//         const delegated = await tokenState.getDelegatedCount.call(holder);
//         delegated.toNumber().should.be.equal(0);
//     });

//     it("should become delegated after month end if is accepted", async () => {
//         const amount = 100;
//         const time = await currentTime(web3);
//         await delegationController.addDelegation(holder, "5", amount.toString(), "3", time, "INFO");
//         const delegationId = 0;

//         await tokenState.accept(delegationId);

//         // skip month
//         const month = 60 * 60 * 24 * 31;
//         skipTime(web3, month);

//         const state = await tokenState.getState.call(delegationId);
//         state.toNumber().should.be.equal(State.DELEGATED);
//         const locked = await tokenState.getLockedCount.call(holder);
//         locked.toNumber().should.be.equal(amount);
//         const delegated = await tokenState.getDelegatedCount.call(holder);
//         delegated.toNumber().should.be.equal(amount);
//     });

//     it("should not allow to request undelegation while is not delegated", async () => {
//         const amount = 100;
//         const time = await currentTime(web3);
//         await delegationController.addDelegation(holder, "5", amount.toString(), "3", time, "INFO");
//         const delegationId = 0;

//         await tokenState.accept(delegationId);

// await tokenState.requestUndelegation(delegationId).should.be.eventually.rejectedWith("Can't request undelegation");
//     });

//     it("should allow to send undelegation request", async () => {
//         const amount = 100;
//         const period = 3;
//         const time = await currentTime(web3);
//         await delegationController.addDelegation(holder, "5", amount.toString(), period.toString(), time, "INFO");
//         const delegationId = 0;

//         await tokenState.accept(delegationId);

//         // skip month
//         const month = 60 * 60 * 24 * 31;
//         skipTime(web3, month);

//         await tokenState.requestUndelegation(delegationId);

//         let state = await tokenState.getState.call(delegationId);
//         state.toNumber().should.be.equal(State.ENDING_DELEGATED);
//         let locked = await tokenState.getLockedCount.call(holder);
//         locked.toNumber().should.be.equal(amount);
//         let delegated = await tokenState.getDelegatedCount.call(holder);
//         delegated.toNumber().should.be.equal(amount);

//         skipTime(web3, month * period);

//         state = await tokenState.getState.call(delegationId);
//         state.toNumber().should.be.equal(State.COMPLETED);
//         locked = await tokenState.getLockedCount.call(holder);
//         locked.toNumber().should.be.equal(0);
//         delegated = await tokenState.getDelegatedCount.call(holder);
//         delegated.toNumber().should.be.equal(0);
//     });

//     it("should not allow to accept request after end of the month", async () => {
//         const amount = 100;
//         const period = 3;
//         const time = await currentTime(web3);
//         await delegationController.addDelegation(holder, "5", amount.toString(), period.toString(), time, "INFO");
//         const delegationId = 0;

//         // skip month
//         const month = 60 * 60 * 24 * 31;
//         skipTime(web3, month);

//         await tokenState.accept(delegationId).should.eventually.be.rejectedWith("Can't set state to accepted");

//         const state = await tokenState.getState.call(delegationId);
//         state.toNumber().should.be.equal(State.COMPLETED);
//         const locked = await tokenState.getLockedCount.call(holder);
//         locked.toNumber().should.be.equal(0);
//         const delegated = await tokenState.getDelegatedCount.call(holder);
//         delegated.toNumber().should.be.equal(0);
//     });

//     it("should not allow to cancel accepted request", async () => {
//         const amount = 100;
//         const period = 3;
//         const time = await currentTime(web3);
//         await delegationController.addDelegation(holder, "5", amount.toString(), period.toString(), time, "INFO");
//         const delegationId = 0;

//         await tokenState.accept(delegationId);

//         await tokenState.cancel(delegationId).should.be.eventually.rejectedWith("Can't cancel delegation request");
//     });

//     it("should not allow to get state of non existing delegation", async () => {
//         await tokenState.getState.call("0xd2").should.be.eventually.rejectedWith("Delegation does not exist");
//     });

//     describe("Token sale", async () => {
//         it("should allow to mark tokens as sold", async () => {
//             const totalAmount = 100;
//             await tokenState.sold(holder, totalAmount.toString());

//             const locked = await tokenState.getLockedCount.call(holder);
//             locked.toNumber().should.be.equal(totalAmount);
//             const delegated = await tokenState.getDelegatedCount.call(holder);
//             delegated.toNumber().should.be.equal(0);
//         });

//         describe("When purchased 100 tokens", async () => {
//             const totalAmount = 100;

//             beforeEach(async () => {
//                 await tokenState.sold(holder, totalAmount.toString());
//             });

//             it("should not unlock purchased tokens if delegation request was cancelled", async () => {
//                 const amount = 100;
//                 const period = 3;
//                 const time = await currentTime(web3);
//                 await delegationController.addDelegation(
//                     holder, "5", amount.toString(), period.toString(), time, "INFO");
//                 const delegationId = 0;
//                 const delegation = await delegationController.getDelegation(delegationId);
//                 delegation.holder.should.be.deep.equal(holder);

//                 await tokenState.cancel(delegationId);

//                 const locked = await tokenState.getLockedCount.call(holder);
//                 locked.toNumber().should.be.equal(totalAmount);
//                 const delegated = await tokenState.getDelegatedCount.call(holder);
//                 delegated.toNumber().should.be.equal(0);
//             });

//             it("should unlock all tokens if 50% was delegated", async () => {
//                 const amount = 50;
//                 const period = 3;
//                 const time = await currentTime(web3);
//                 await delegationController.addDelegation(
//                     holder, "5", amount.toString(), period.toString(), time, "INFO");
//                 const delegationId = 0;

//                 await tokenState.accept(delegationId);

//                 // skip month
//                 const month = 60 * 60 * 24 * 31;
//                 skipTime(web3, month);

//                 let delegated = await tokenState.getDelegatedCount.call(holder);
//                 delegated.toNumber().should.be.equal(amount);

//                 await tokenState.requestUndelegation(delegationId);

//                 skipTime(web3, month * period);

//                 const state = await tokenState.getState.call(delegationId);
//                 state.toNumber().should.be.equal(State.COMPLETED);
//                 const locked = await tokenState.getLockedCount.call(holder);
//                 locked.toNumber().should.be.equal(0);
//                 delegated = await tokenState.getDelegatedCount.call(holder);
//                 delegated.toNumber().should.be.equal(0);
//             });

//             it("should unlock only 40% tokens if 40% was delegated", async () => {
//                 const amount = 40;
//                 const period = 3;
//                 const time = await currentTime(web3);
//                 await delegationController.addDelegation(
//                     holder, "5", amount.toString(), period.toString(), time, "INFO");
//                 const delegationId = 0;

//                 await tokenState.accept(delegationId);

//                 // skip month
//                 const month = 60 * 60 * 24 * 31;
//                 skipTime(web3, month);

//                 let delegated = await tokenState.getDelegatedCount.call(holder);
//                 delegated.toNumber().should.be.equal(amount);

//                 await tokenState.requestUndelegation(delegationId);

//                 delegated = await tokenState.getDelegatedCount.call(holder);
//                 delegated.toNumber().should.be.equal(amount);

//                 skipTime(web3, month * period);

//                 const state = await tokenState.getState.call(delegationId);
//                 state.toNumber().should.be.equal(State.COMPLETED);
//                 const locked = await tokenState.getLockedCount.call(holder);
//                 locked.toNumber().should.be.equal(totalAmount - amount);
//                 delegated = await tokenState.getDelegatedCount.call(holder);
//                 delegated.toNumber().should.be.equal(0);
//             });

//             it("should unlock all tokens if 40% was delegated and then 10% was delegated", async () => {
//                 // delegate 40%
//                 let amount = 40;
//                 const period = 3;
//                 let time = await currentTime(web3);
//                 await delegationController.addDelegation(
//                     holder, "5", amount.toString(), period.toString(), time, "INFO");
//                 let delegationId = 0;

//                 await tokenState.accept(delegationId);

//                 // skip month
//                 const month = 60 * 60 * 24 * 31;
//                 skipTime(web3, month);

//                 let delegated = await tokenState.getDelegatedCount.call(holder);
//                 delegated.toNumber().should.be.equal(amount);

//                 await tokenState.requestUndelegation(delegationId);

//                 skipTime(web3, month * period);

//                 let state = await tokenState.getState.call(delegationId);
//                 state.toNumber().should.be.equal(State.COMPLETED);
//                 let locked = await tokenState.getLockedCount.call(holder);
//                 locked.toNumber().should.be.equal(totalAmount - amount);
//                 delegated = await tokenState.getDelegatedCount.call(holder);
//                 delegated.toNumber().should.be.equal(0);

//                 // delegate 10%
//                 amount = 10;
//                 time = await currentTime(web3);
//                 await delegationController.addDelegation(
//                     holder, "5", amount.toString(), period.toString(), time, "INFO");
//                 delegationId = 1;

//                 await tokenState.accept(delegationId);

//                 // skip month
//                 skipTime(web3, month);

//                 state = await tokenState.getState.call(delegationId);
//                 state.toNumber().should.be.equal(State.DELEGATED);
//                 delegated = await tokenState.getDelegatedCount.call(holder);
//                 delegated.toNumber().should.be.equal(amount);
//                 await tokenState.requestUndelegation(delegationId);

//                 skipTime(web3, month * period);

//                 state = await tokenState.getState.call(delegationId);
//                 state.toNumber().should.be.equal(State.COMPLETED);
//                 locked = await tokenState.getLockedCount.call(holder);
//                 locked.toNumber().should.be.equal(0);
//                 delegated = await tokenState.getDelegatedCount.call(holder);
//                 delegated.toNumber().should.be.equal(0);
//             });
//         });
//     });
});
