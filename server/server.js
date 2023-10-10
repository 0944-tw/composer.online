let configuration = {
  php_executable: "./php/php.exe",
  php_memory: "64M",
  rate_limit: {
    enabled: true,
    per_second: 60
  },
  queue_system: {
    enabled: true,
    queue_when_resources: 80
  }
};

const WebSocket = require("ws");
const FTP = require("basic-ftp");
const { spawn } = require("child_process");
const wss = new WebSocket.Server({ port: 8080 });
const fs = require("fs");
const path = require('path');
const { config } = require("process");
/**
 * Calculates the size of a directory recursively.
 * @param {string} dirPath - The path of the directory to calculate the size of.
 * @returns {Promise<number>} A Promise that resolves with the size of the directory in bytes.
 */
async function dirSize(dirPath) {
  let size = 0;
  const files = await fs.promises.readdir(dirPath);
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stats = await fs.promises.stat(filePath);
    if (stats.isDirectory()) {
      size += await dirSize(filePath);
    } else {
      size += stats.size;
    }
  }
  return size;
}

/**
 * Generates a random string of a given length.
 * @param {number} length - The length of the random string to generate.
 * @returns {string} A random string of the given length.
 */
function randomNumber(length) {
  var result = "";
  var characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

/**
 * Generates a random ID string.
 * @returns {string} A random ID string.
 */
function randomID() {
  return `${randomNumber(5)}-${randomNumber(5)}-${randomNumber(5)}-${randomNumber(5)}`;
}

/**
 * Logs in to an FTP server.
 * @param {string} ftpinfo - The FTP server information in the format "username@hostname".
 * @param {string} password - The password for the FTP server.
 * @param {boolean} [secure=false] - Whether to use a secure connection to the FTP server.
 * @returns {Promise<FTP.Client|boolean>} A Promise that resolves with the FTP client if the login was successful, or false if an error occurred.
 */
let ftp_login = async (ftpinfo, password, secure = false) => {
  let ftp = new FTP.Client();
  let username = ftpinfo.split("@")[0];
  let hostname = ftpinfo.split("@")[1];

  try {
    await ftp.access({
      host: hostname,
      user: username,
      password: password,
      secure: secure,
    });
    return ftp;
  } catch (err) {
    return false;
  }
};

/**
 * Changes the current working directory of an FTP client.
 * @param {FTP.Client} ftp - The FTP client to use.
 * @param {string} dir - The directory to change to.
 * @returns {Promise<FTP.Client|boolean>} A Promise that resolves with the FTP client if the directory was changed successfully, or false if an error occurred.
 */
let ftp_gotodir = async (ftp, dir) => {
  try {
    await ftp.cd(dir);
    return ftp;
  } catch (err) {
    console.log(err);
    return false;
  }
};

/**
 * Validates a JSON string.
 * @param {string} json - The JSON string to validate.
 * @returns {boolean|object} Returns the parsed JSON object if the string is valid JSON, or false if it is not.
 */
let validate_json = (json) => {
  try {
    return JSON.parse(json);
  } catch {
    return false;
  }
};

// Main Code Part

const NodeCache = require( "node-cache" );
const ipCache = new NodeCache();

wss.on("connection", function connection(ws) {
  console.log("Client connected");
  let randomId = randomID();
  ws.send(`Connected: ${randomId}`);
  if (ipCache.has(ws._socket.remoteAddress)) {
    ws.send("You are being rate limited, please try again later");
    ws.close(1008,"Rate Limited")
  }
  ipCache.set(ws._socket.remoteAddress, 0,120)
  ws.on("message", async function incoming(message) {
    console.log("received: %s", message);
    try {
      let data = JSON.parse(message);
      ws.send("[1/3] Validating required fields ⚙️");
      if (!data.ftpinfo || !data.password || !data.uploadDirectory || !data.composercontent) {
        ws.send("Error: Missing required fields");
        ws.close();
        return;
      }
      ws.send("Success: Received all required fields");
      if (!validate_json(data.composercontent)) {
        ws.send("Error: Composer content is not valid JSON");
        ws.close();
        return;
      }

      let composer_json = JSON.parse(data.composercontent);

      ws.send("Validating FTP Credentials");
      let ftp = await ftp_login(data.ftpinfo, data.password);
      if (!ftp) {
        ws.send("Error: FTP Credentials are invalid");
        ws.close();
        return;
      }

      ws.send("Validating upload directory");
      let list = await ftp.list();
      let directoryExists = await ftp_gotodir(ftp, data.uploadDirectory);
      if (!directoryExists) {
        ws.send("Error: Upload directory does not exist");
        ws.close(1008,"Upload directory does not exist");
        return;
      }
      ws.send("Success: Upload directory exists");
      ws.send("[2/3] Download Composer Package 📦");

      let installFolder = await fs.mkdirSync(`./temp/${randomId}`);
      let composer_json_file = await fs.writeFileSync(`./temp/${randomId}/composer.json`, data.composercontent);

      const composer = spawn(configuration.php_executable, [
        "-d",
        "--memory-limit=" + configuration.php_memory,
        "composer.phar",
        "install",
        `--working-dir=./temp/${randomId}`,
      ]);

      composer.stdout.on("data", (data) => {
        const lines = data.toString().split("\n");
        lines.forEach((line) => {
          console.log(line);
          ws.send(line);
        });
      });

      composer.stderr.on("data", (data) => {
        console.log(data.toString());
        ws.send(data.toString());
        ws.send("[2/3] Failed to download composer package ")
        ws.close(1008,"Failed to download composer package");
      });

      composer.on("close", async (code) => {
        let size = await dirSize(`./temp/${randomId}`)
        ws.send("[3/3] Uploading to FTP 📡");
        ftp.uploadFromDir(`./temp/${randomId}`)
        ftp.trackProgress((info) => {
          if (info.byte = 0) return;
          ws.send(`Uploaded ${info.bytes} bytes so far - ${info.name} Uploaded ${info.bytesOverall / size * 100}%`)
        })
      });
    } catch (err) {
      ws.send(toString(err));
      ws.send("An error occured, please try again later");
      console.log(err);
      ws.close();
    }
  });
  ws.on("close", () => {
    console.log("Client disconnected");
    ipCache.del(ws._socket.remoteAddress);
    try {
      fs.rmdirSync(`./temp/${randomId}`, { recursive: true , force: true});
    } catch (err) {
      console.log(err); 
    }
  });
});