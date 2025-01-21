const mongoose = require('mongoose');
const Feed = require('./feed.model');

const FodderSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  components: [{
    feedId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Feed', 
      required: true 
    },
    quantity: { 
      type: Number, 
      required: true 
    }
  }],
  totalQuantity: {
    type: Number, 
    required: true 
  },
  totalPrice:{
    type: Number
},
  createdAt: {
    type: Date, 
    default: Date.now 
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  }
});

module.exports = mongoose.model('Fodder', FodderSchema);
