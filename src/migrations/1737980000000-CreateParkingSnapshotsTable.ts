import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from "typeorm";

export class CreateParkingSnapshotsTable1737980000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Crear tabla parking_snapshots
        await queryRunner.createTable(
            new Table({
                name: "parking_snapshots",
                columns: [
                    {
                        name: "id",
                        type: "uuid",
                        isPrimary: true,
                        generationStrategy: "uuid",
                        default: "uuid_generate_v4()",
                    },
                    {
                        name: "cameraId",
                        type: "uuid",
                        isNullable: true,
                    },
                    {
                        name: "totalSpaces",
                        type: "int",
                    },
                    {
                        name: "occupiedSpaces",
                        type: "int",
                    },
                    {
                        name: "freeSpaces",
                        type: "int",
                    },
                    {
                        name: "occupancyRate",
                        type: "decimal",
                        precision: 5,
                        scale: 2,
                    },
                    {
                        name: "timestamp",
                        type: "timestamp",
                        default: "now()",
                    },
                    {
                        name: "metadata",
                        type: "jsonb",
                        isNullable: true,
                    },
                ],
            }),
            true,
        );

        // Crear foreign key hacia cameras (nullable)
        await queryRunner.createForeignKey(
            "parking_snapshots",
            new TableForeignKey({
                columnNames: ["cameraId"],
                referencedColumnNames: ["id"],
                referencedTableName: "cameras",
                onDelete: "SET NULL",
            }),
        );

        // Crear índices para mejorar rendimiento de consultas
        await queryRunner.createIndex(
            "parking_snapshots",
            new TableIndex({
                name: "IDX_PARKING_SNAPSHOTS_TIMESTAMP",
                columnNames: ["timestamp"],
            }),
        );

        await queryRunner.createIndex(
            "parking_snapshots",
            new TableIndex({
                name: "IDX_PARKING_SNAPSHOTS_CAMERA_TIMESTAMP",
                columnNames: ["cameraId", "timestamp"],
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Eliminar índices
        await queryRunner.dropIndex("parking_snapshots", "IDX_PARKING_SNAPSHOTS_CAMERA_TIMESTAMP");
        await queryRunner.dropIndex("parking_snapshots", "IDX_PARKING_SNAPSHOTS_TIMESTAMP");

        // Eliminar foreign key
        const table = await queryRunner.getTable("parking_snapshots");
        const foreignKey = table?.foreignKeys.find(
            (fk) => fk.columnNames.indexOf("cameraId") !== -1,
        );
        if (foreignKey) {
            await queryRunner.dropForeignKey("parking_snapshots", foreignKey);
        }

        // Eliminar tabla
        await queryRunner.dropTable("parking_snapshots");
    }
}
