using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FinanceTracker.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAlertSnapshot : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "Amount",
                table: "Alerts",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<int>(
                name: "DaysLeft",
                table: "Alerts",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "Percent",
                table: "Alerts",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddCheckConstraint(
                name: "CK_Alerts_Amount_NonNegative",
                table: "Alerts",
                sql: "\"Amount\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Alerts_DaysLeft_Range",
                table: "Alerts",
                sql: "\"DaysLeft\" BETWEEN 1 AND 31");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Alerts_Percent_NonNegative",
                table: "Alerts",
                sql: "\"Percent\" >= 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Alerts_Amount_NonNegative",
                table: "Alerts");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Alerts_DaysLeft_Range",
                table: "Alerts");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Alerts_Percent_NonNegative",
                table: "Alerts");

            migrationBuilder.DropColumn(
                name: "Amount",
                table: "Alerts");

            migrationBuilder.DropColumn(
                name: "DaysLeft",
                table: "Alerts");

            migrationBuilder.DropColumn(
                name: "Percent",
                table: "Alerts");
        }
    }
}
