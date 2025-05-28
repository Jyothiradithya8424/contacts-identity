const { dbPool } = require("../db");

const dedupe = arr => [...new Set(arr.filter(Boolean))];

const structureResponse = (primaryId, contacts) => {
  const emails = dedupe(contacts.map(c => c.email));
  const phoneNumbers = dedupe(contacts.map(c => c.phonenumber));
  const secondaryIds = contacts
    .filter(c => c.linkprecedence === "secondary")
    .map(c => c.id);

  return {
    primaryContatctId: primaryId,
    emails,
    phoneNumbers,
    secondaryContactIds: secondaryIds
  };
};

const handleContactIdentification = async (req, res) => {
  const { email, phoneNumber } = req.body;

  if (!email && !phoneNumber) {
    return res.status(400).json({ error: "At least one of email or phoneNumber is required." });
  }

  const client = await dbPool.connect();
  try {
    await client.query("BEGIN");

    const { rows: matched } = await client.query(
      `SELECT * FROM contact WHERE email = $1 OR phoneNumber = $2 ORDER BY createdAt ASC`,
      [email, phoneNumber]
    );

    if (matched.length === 0) {
      const { rows: inserted } = await client.query(
        `INSERT INTO contact (email, phoneNumber, linkPrecedence, createdAt, updatedAt)
         VALUES ($1, $2, 'primary', NOW(), NOW()) RETURNING *`,
        [email, phoneNumber]
      );

      const newEntry = inserted[0];
      await client.query("COMMIT");

      return res.status(200).json({
        contact: structureResponse(newEntry.id, [newEntry])
      });
    }

    const rootPrimary = matched.find(c => c.linkprecedence === "primary") || matched[0];
    const primaryId = rootPrimary.id;

    for (const c of matched) {
      if (c.linkprecedence === "primary" && c.id !== primaryId) {
        await client.query(
          `UPDATE contact
           SET linkPrecedence = 'secondary', linkedId = $1, updatedAt = NOW()
           WHERE id = $2`,
          [primaryId, c.id]
        );
      }
    }

    const existingEmails = matched.map(c => c.email);
    const existingPhones = matched.map(c => c.phonenumber);

    const emailMissing = email && !existingEmails.includes(email);
    const phoneMissing = phoneNumber && !existingPhones.includes(phoneNumber);

    if (emailMissing || phoneMissing) {
      await client.query(
        `INSERT INTO contact (email, phoneNumber, linkPrecedence, linkedId, createdAt, updatedAt)
         VALUES ($1, $2, 'secondary', $3, NOW(), NOW())`,
        [email, phoneNumber, primaryId]
      );
    }

    const { rows: fullSet } = await client.query(
      `SELECT * FROM contact
       WHERE id = $1 OR linkedId = $1 OR linkedId IN (
         SELECT id FROM contact WHERE linkedId = $1
       )
       ORDER BY createdAt ASC`,
      [primaryId]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      contact: structureResponse(primaryId, fullSet)
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error(" Error in identify handler:", error);
    res.status(500).json({ error: "Something went wrong internally." });
  } finally {
    client.release();
  }
};

module.exports = {
  handleContactIdentification
};