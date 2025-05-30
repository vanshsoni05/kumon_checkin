const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

exports.clearOldCheckInsDaily = functions.pubsub
  .schedule("every day 00:00")
  .timeZone("America/Chicago") // Adjust to your local time zone
  .onRun(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Midnight today

    const snapshot = await db.collection("check_ins").get();

    const deletions = snapshot.docs
      .filter(doc => {
        const checkInTime = new Date(doc.data().timestamp);
        return checkInTime < today;
      })
      .map(doc => doc.ref.delete());

    await Promise.all(deletions);

    console.log(`✅ Deleted ${deletions.length} old check-ins.`);
    return null;
  });
