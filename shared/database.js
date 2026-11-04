function database(mongoose, name) {
  mongoose.set('bufferTimeoutMS', 3000);
  return {
    ready: () => mongoose.connection.readyState === 1,
    connect: async () => {
      await mongoose.connect(process.env.MONGO_URI || `mongodb://127.0.0.1:27017/eventpass_${name}`, { serverSelectionTimeoutMS: 5000 });
      console.log(`[${name}] MongoDB connected`);
    }
  };
}
module.exports = database;
