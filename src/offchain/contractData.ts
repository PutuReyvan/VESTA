import { Contract, JsonRpcProvider } from "ethers";
import type { ContractSchedule } from "./types";

const VESTING_MANAGER_ABI = [
  "function getSchedule(uint256) view returns (uint256 scheduleId, address beneficiary, uint256 allocation, uint64 start, uint64 cliff, uint64 duration, uint256 released)",
  "function getBeneficiarySchedules(address) view returns (uint256[])",
  "function vestedAmount(uint256) view returns (uint256)",
  "function claimableAmount(uint256) view returns (uint256)",
] as const;

export class ContractDataService {
  private readonly contract: Contract;

  constructor(rpcUrl: string, managerAddress: string) {
    this.contract = new Contract(managerAddress, VESTING_MANAGER_ABI, new JsonRpcProvider(rpcUrl));
  }

  async getSchedule(scheduleId: bigint): Promise<ContractSchedule> {
    const schedule = await this.contract.getSchedule(scheduleId);
    return {
      scheduleId: schedule[0],
      beneficiary: schedule[1],
      allocation: schedule[2],
      start: schedule[3],
      cliff: schedule[4],
      duration: schedule[5],
      released: schedule[6],
    };
  }

  getBeneficiarySchedules(walletAddress: string): Promise<bigint[]> {
    return this.contract.getBeneficiarySchedules(walletAddress);
  }

  vestedAmount(scheduleId: bigint): Promise<bigint> {
    return this.contract.vestedAmount(scheduleId);
  }

  claimableAmount(scheduleId: bigint): Promise<bigint> {
    return this.contract.claimableAmount(scheduleId);
  }
}
