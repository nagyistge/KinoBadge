/*!
 * The controller service which has the business logic.
 * This service would delegate rest of the calls to underlying
 * service. for e.g. delegating data related calls to userDataService
 *
 */

var userDataService = require('./userDataService').service();
var badgeDataService = require('./badgeDataService').service();
var subscriptionDataService = require('./subscriptionDataService').service();

exports.service = function() {
  return {
    getUsersBySubscription: function(subscription, callBack) {
      userDataService.getUsersBySubscription(subscription, function(users) {
        if(users && users.length > 0){
          badgeDataService.getBadgesBySubscription(subscription, function(badges) {
            users.forEach(function(user) {
              user.badges.forEach(function(myBadge) {
                badges.forEach(function(badge) {
                  // we need to check ObjectId of badge._id against the string of myBadge._id
                  if (badge._id == myBadge._id) {
                    user[badge.name] = 1;
                  } else {
                    user[badge.name] = 0;
                  }
                });
              });
            });
          callBack(users);
          });
        }else{
          callBack([]);
        }
      });
    },
    getUserByOAuthId: function(fbUser,callBack){
      userDataService.getUserByOAuthId(fbUser,callBack);
    },
    updateUser: function(user,callBack){
     console.log(JSON.stringify(user));
     callBack(user);
    },
    saveUser: function(user,callBack){
      console.log("Save the user -- "+JSON.stringify(user));
      callBack(user);
    }
  }
};