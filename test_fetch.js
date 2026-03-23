console.log("fetching activities"); import("./src/generated/services/Crc5b_activitycodedirectoriesService.ts").then(s => s.Crc5b_activitycodedirectoriesService.getAll({top: 2}).then(console.log))
