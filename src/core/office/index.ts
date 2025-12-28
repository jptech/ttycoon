export {
  OfficeManager,
  OFFICE_CONFIG,
  type OfficeState,
  type RoomAvailability,
  type UpgradeResult,
} from './OfficeManager'

export { OfficeUpgradeManager, type PurchaseResult } from './OfficeUpgradeManager'

export {
  OFFICE_UPGRADES,
  getAllUpgrades,
  getUpgradeConfig,
  getUpgradesByCategory,
  getUpgradesByLine,
  getUpgradeLines,
} from './upgradeConfigs'
