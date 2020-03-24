var co = require('co');
var every = require('schedule').every;
var ActiveDirectory = require('activedirectory');
var NodeGitlab = require('node-gitlab');
const util = require('util')


var ACCESS_LEVEL_OWNER = 50;
var ACCESS_LEVEL_NORMAL = 30;

module.exports = GitlabLdapGroupSync;

var isRunning = false;
var gitlab = undefined;
//var ldap = undefined;
var ldapServers = [];

function GitlabLdapGroupSync(config) {
  if (!(this instanceof GitlabLdapGroupSync))
    return new GitlabLdapGroupSync(config)

  gitlab = NodeGitlab.createThunk(config.gitlab);
  for (var ldapServer of config.ldap.servers) {
    var ldapServerObj = new ActiveDirectory(ldapServer);
    ldapServers.push(ldapServerObj);
  }
  this.config = config
}

GitlabLdapGroupSync.prototype.sync = function () {

  if (isRunning) {
    console.log('ignore trigger, a sync is already running');
    return;
  }
  isRunning = true;

  co(function* () {
    // find all users with a ldap identiy
    var gitlabUsers = [];
    var pagedUsers = [];
    var i=0;
    do {
      i++;
      pagedUsers = yield gitlab.users.list({ per_page: 100, page: i });
      gitlabUsers.push.apply(gitlabUsers, pagedUsers);

    }
    while(pagedUsers.length == 100);

    var gitlabUserMap = {};
    var gitlabLocalUserIds = [];
    for (var user of gitlabUsers) {
      if (user.identities.length > 0) {
        gitlabUserMap[user.username.toLowerCase()] = user.id;
      } else {
        gitlabLocalUserIds.push(user.id);
      }
    }
    console.log('-------------------------');
    console.log('CURRENT GITLAB USERS');
    console.log(gitlabUserMap);
    console.log('-------------------------');

    //set the gitlab group members based on ldap group
    var gitlabGroups = [];
    var pagedGroups = [];
    var i=0;
    do {
      i++;
      pagedGroups = yield gitlab.groups.list({ per_page: 100, page: i });
      gitlabGroups.push.apply(gitlabGroups, pagedGroups);

    }
    while(pagedGroups.length == 100);

    var membersDefault = yield this.resolveLdapGroupMembers(ldapServers, 'default', gitlabUserMap);

    for (var gitlabGroup of gitlabGroups) {
      console.log('-------------------------');
      console.log('group:', gitlabGroup.name , ' group.id:',gitlabGroup.id, ' group.parent_id:',gitlabGroup.parent_id);
      var gitlabGroupMembers = [];
      var pagedGroupMembers = [];
      var i=0;
      do {
        i++;
        pagedGroupMembers = yield gitlab.groupMembers.list({ id: gitlabGroup.id, per_page: 100, page: i });
        gitlabGroupMembers.push.apply(gitlabGroupMembers, pagedGroupMembers);
      }
      while(pagedGroupMembers.length == 100);

      var groupName = gitlabGroup.name;
      var currentMemberIds = [];
      for (var member of gitlabGroupMembers) {
        if (gitlabLocalUserIds.indexOf(member.id) > -1) {
          continue; //ignore local users
        }
        currentMemberIds.push(member.id);
      }
      if (this.config.groupMappings != null) {
        var configGroupMapping = this.config.groupMappings[gitlabGroup.id]
        var allGroupMembers = [];
        if (configGroupMapping != null) {
          for (var configLdapGroup of configGroupMapping.ldapGroups) {
            ldapGroupName = configLdapGroup.ldapGroupName;
            var ldapMembers = yield this.resolveLdapGroupMembers(ldapServers, ldapGroupName, gitlabUserMap);
            ldapMembers = (ldapMembers && ldapMembers.length) ? ldapMembers : membersDefault;
            Array.prototype.push.apply(allGroupMembers, ldapMembers);
            
            for (var member of gitlabGroupMembers) {
              if (gitlabLocalUserIds.indexOf(member.id) > -1) {
                continue; //ignore local users
              }
              var access_level = configLdapGroup.access_level;
              if (member.access_level !== access_level) {
                console.log('update group member permission', { id: gitlabGroup.id, user_id: member.id, access_level: access_level });
                gitlab.groupMembers.update({ id: gitlabGroup.id, user_id: member.id, access_level: access_level });
              }
            }
            //add new users
            var toAddIds = ldapMembers.filter(x => currentMemberIds.indexOf(x) == -1);
            for (var id of toAddIds) {
              var access_level = configLdapGroup.access_level;
              console.log('add group member', { id: gitlabGroup.id, user_id: id, access_level: access_level });
              gitlab.groupMembers.create({ id: gitlabGroup.id, user_id: id, access_level: access_level });
            }

          }
          //remove unlisted users
          var toDeleteIds = currentMemberIds.filter(x => allGroupMembers.indexOf(x) == -1);
          if (toDeleteIds && toDeleteIds.length > 0) {
            if (configGroupMapping.removeUnlistedUsers) {
              for (var id of toDeleteIds) {
                console.log('delete group member', { id: gitlabGroup.id, user_id: id });
                gitlab.groupMembers.remove({ id: gitlabGroup.id, user_id: id });
              }
            } else {
              console.log('removeUnlistedUsers is false not removing users for group', groupName);
            }
          }
        }
      }
    }

  }.bind(this)).then(function (value) {
    console.log('sync done');
    isRunning = false;
  }, function (err) {
    console.error(err.stack);
    isRunning = false;
  });
}

var ins = undefined;

GitlabLdapGroupSync.prototype.startScheduler = function (interval) {
  this.stopScheduler();
  ins = every(interval).do(this.sync.bind(this));
}

GitlabLdapGroupSync.prototype.stopScheduler = function () {
  if (ins) {
    ins.stop();
  }
  ins = undefined;
}

GitlabLdapGroupSync.prototype.resolveLdapGroupMembers = async function(ldapServers, group, gitlabUserMap) {
  var result = [];
  for (var ldap of ldapServers) {
    var promise = this.resolveLdapGroupMembersLdap(ldap, group, gitlabUserMap);    
    await promise;
    promise.then(function(groupMembers) {
      if (groupMembers && groupMembers.length > 0) {
        console.log('Members=' + groupMembers + " group: " + group);
        result.push.apply(result, groupMembers);
      }
    }, function(err) {
      console.log(err); // Error: "It broke"
    });
  }
  if (result && result.length > 0) {
    console.log('resolveLdapGroupMembers=' + result + " group: " + group);
  }
  return result;
}
GitlabLdapGroupSync.prototype.resolveLdapGroupMembersLdap = function(ldap, group, gitlabUserMap) {
  var groupName = (this.config.groupPrefix || '') + group
  console.log('Loading users for group: ' + groupName)
  return new Promise(function (resolve, reject) {

    ldap.getUsersForGroup(groupName, function (err, users) {
      if (err) {
        reject(err);
        return;
      }

      groupMembers = [];
      if(users) {
        console.log('Users for group:' + groupName);
        for (var user of users) {
          //console.log('ldap user sAMAccountName:' + user.sAMAccountName + " user.dn " + user.dn);
          //console.log('ldap user id:' + util.inspect(user, {showHidden: false, depth: null}));
          if (gitlabUserMap[user.sAMAccountName.toLowerCase()]) {
            groupMembers.push(gitlabUserMap[user.sAMAccountName.toLowerCase()]);
          }
        }
      }
      resolve(groupMembers);
      if (groupMembers && groupMembers.length > 0) {
        //console.log('Members=' + groupMembers);      
      }
    });
  });
}