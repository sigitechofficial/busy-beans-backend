const { employee } = require("../models");
const bcrypt = require("bcryptjs");

async function testPasswordUpdate() {
  let createdEmp = null;
  try {
    console.log("Starting password update verification...");

    // 1. Create a test employee
    const email = `verify_hash_${Date.now()}@example.com`;
    const password = "initialPassword123";

    createdEmp = await employee.create({
      name: "Verification User",
      email: email,
      password: password,
      employeeOf: "Admin",
    });
    console.log(`Created test employee (ID: ${createdEmp.id})`);

    // 2. Simulate the controller update
    const newPassword = "updatedPassword456";

    // NOTE: This MUST match the code in the controller we just fixed
    await employee.update(
      { password: newPassword },
      {
        where: { id: createdEmp.id },
        individualHooks: true,
      },
    );
    console.log("Performed update operation");

    // 3. Verify the result
    const updatedEmp = await employee.findByPk(createdEmp.id);

    // Check if password matches plain text (FAILURE case)
    if (updatedEmp.password === newPassword) {
      console.error("❌ FAILURE: Password was stored as plain text!");
      process.exit(1);
    }

    // Check if password matches hash (SUCCESS case)
    const isMatch = await bcrypt.compare(newPassword, updatedEmp.password);
    if (isMatch) {
      console.log("✅ SUCCESS: New password was correctly hashed.");
    } else {
      console.error(
        "❌ FAILURE: Password does not match hash (unknown error).",
      );
      console.log("Stored:", updatedEmp.password);
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Error during verification:", error);
    process.exit(1);
  } finally {
    // Cleanup
    if (createdEmp) {
      await createdEmp.destroy({ force: true });
      console.log("Cleaned up test user.");
    }
    process.exit(0);
  }
}

testPasswordUpdate();
