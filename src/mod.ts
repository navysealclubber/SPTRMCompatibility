import { DependencyContainer } from "tsyringe";
import { ILogger } from "@spt/models/spt/utils/ILogger";
import { IPostDBLoadMod } from "@spt/models/external/IPostDBLoadMod";
import { DatabaseServer } from "@spt/servers/DatabaseServer";
import { IDatabaseTables } from "@spt/models/spt/server/IDatabaseTables";
import { FileSystemSync } from "@spt/utils/FileSystemSync";
import { jsonc } from "jsonc";
import path from "path";

class RMC implements IPostDBLoadMod
{
    public postDBLoad(container: DependencyContainer): void
    {
        const LOGGER = container.resolve<ILogger>("WinstonLogger");

		const FSS = container.resolve<FileSystemSync>("FileSystemSync");
        const ARMOR_LIST = jsonc.parse(FSS.read(path.resolve(__dirname, "../db/armor.jsonc")));
        const PLATE_LIST = jsonc.parse(FSS.read(path.resolve(__dirname, "../db/plates.jsonc")));
        const AMMO_LIST = jsonc.parse(FSS.read(path.resolve(__dirname, "../db/ammo.jsonc")));

        const DB = container.resolve<DatabaseServer>("DatabaseServer");
        const TABLES: IDatabaseTables = DB.getTables();
        const ITEMS = TABLES.templates.items;

        function setSoftInsert(INSERT, ARMOR_CLASS, ARMOR_DURABILITY, DURABILITY_MULTIPLIER): void
        {
            INSERT._props.Durability = ARMOR_DURABILITY * DURABILITY_MULTIPLIER;
            INSERT._props.MaxDurability = INSERT._props.Durability;
            INSERT._props.armorClass = ARMOR_CLASS;
            INSERT._props.BluntThroughput = 0.05;
        }

        //MARK: ARMOR
        function processArmor(ITEM): void
        {
            const ARMOR = ARMOR_LIST[ITEM?._id];
            if (ARMOR) {

                for (const SLOT of ITEM._props.Slots) {

                    const SLOT_NAME = SLOT._name.toLowerCase();
                    const PLATE = ITEMS[SLOT._props.filters[0].Plate];
                    const ARMOR_CLASS = ARMOR.class.length > 1
                        ? ARMOR.class[1]
                        : ARMOR.class[0];
                    const DURABILITY = ARMOR.durability;

                    switch (SLOT_NAME) {
                        case "soft_armor_front":
                        case "soft_armor_back":
                        case "helmet_top":
                        case "helmet_back":
                            setSoftInsert(PLATE, ARMOR_CLASS, DURABILITY, 1);
                            break;

                        case "soft_armor_left":
                        case "soft_armor_right":
                        case "helmet_eyes":
                            setSoftInsert(PLATE, ARMOR.class[0], DURABILITY, 0.5);
                            break;

                        case "collar":
                            setSoftInsert(PLATE, ARMOR.class[0], DURABILITY, 0.35);
                            break;

                        case "shoulder_l":
                        case "shoulder_r":
                            setSoftInsert(PLATE, ARMOR.class[0], DURABILITY, 0.6);
                            break;

                        case "groin":
                        case "groin_back":
                            setSoftInsert(PLATE, ARMOR.class[0], DURABILITY, 0.4);
                            break;

                        case "helmet_jaw":
                        case "helmet_ears":
                            setSoftInsert(PLATE, ARMOR.class[0], DURABILITY, 0.8);
                            break;
                    }
                }
            }
        }
        
        //MARK: PLATES, ACCESSORIES, MASKS
        function processPlate(ITEM): void
        {
            const PLATE = PLATE_LIST[ITEM?._id];
            if (PLATE) {
                ITEM._props.armorClass = PLATE.class;
                ITEM._props.Durability = PLATE.durability;
                ITEM._props.MaxDurability = ITEM._props.Durability;
                ITEM._props.BluntThroughput = ((100 - PLATE.bdr) / 100);
                if (PLATE.material) ITEM._props.ArmorMaterial = PLATE.material;
                if (PLATE.colliders) ITEM._props.armorColliders = PLATE.colliders;
                if (PLATE.spr) {
                    ITEM._props.CanSpall = true;
                    ITEM._props.SpallReduction = PLATE.spr / 100;
                }
            }
        }

        //MARK: AMMO
        function processAmmo(ITEM): void
        {
            const AMMO = AMMO_LIST[ITEM?._id];
            if (AMMO) {
                ITEM._props.ProjectileCount = AMMO.proj;
                ITEM._props.Damage = AMMO.dmg;
                ITEM._props.PenetrationPower = AMMO.pen;
                ITEM._props.HeavyBleedingDelta = AMMO.hvy / 100;
                ITEM._props.LightBleedingDelta = AMMO.lite / 100;
                // ITEM._props.MalfFeedChance = AMMO.malf / 2;
                // ITEM._props.MalfMisfireChance = AMMO.malf / 2;
                ITEM._props.ammoAccr = AMMO.acc;
                ITEM._props.FragmentationChance = AMMO.frag / 100;
                ITEM._props.DurabilityBurnModificator *= 3;
                ITEM._props.HeatFactor *= 3;
                if (AMMO.spd) ITEM._props.InitialSpeed += AMMO.spd;
                if (AMMO.tcr) {
                    ITEM._props.Tracer = AMMO.tcr[0];
                    ITEM._props.TracerColor = AMMO.tcr[1];
                }
            }
        }

        //MARK: EXEC
        //Armor (and armored rigs)
        for (let i in ARMOR_LIST) {
            processArmor(ITEMS[i]);
        }
        
        //Plates (and masks/accessories)
        for (let i in PLATE_LIST) {
            processPlate(ITEMS[i]);
        }
        
        //Ammo
        for (let i in AMMO_LIST) {
            processAmmo(ITEMS[i]);
        }

        //Multiply armor and repair damage
        const ARMOR_MATERIALS = TABLES.globals.config.ArmorMaterials;

        for (const INDEX in ARMOR_MATERIALS) {
            const MATERIAL = ARMOR_MATERIALS[INDEX];

            for (let parameter in MATERIAL) {
                MATERIAL[parameter] *= 3;
            }
        }

        LOGGER.success(`[RMC] SPT-Realism mod patched successfully`);
    }
}

export const mod = new RMC();
