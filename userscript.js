//Todo
//Credit counter per friend to ignore friends that don't usually get you credits
// 2] Adjustable postDelay
// 3] Toggle to auto accept friend requests upon page load
// 4] Auto friend adder (also check their home page for words that indicate they don't accept random invites)
// 5] Update credits live
//Instead of showing status also turn background-color of the buttons to lime

console.log("Ovi Script Loaded");

//Globar variables
const version = "1.0.21";
var creditsEarned = 0;
var startTime;
var LastGet = Date.now();
var postDelay = 350;

class OviPostModule {
    constructor(name, buttonText, clickHandler) {
        this.name = name;
        this.buttonText = buttonText;
        this.clickHandler = clickHandler;
    }

    render() {
        const buttonId = `btn${this.name}`;
        $("#scriptMenu").append(`<li><input type="button" value="${this.buttonText}" id="${buttonId}"/></li>`);
        const button = $(`#${buttonId}`);
        
        button.on('click', () => {
            button.css('background-color', 'lime');
            this.clickHandler();
            button.css('background-color', '');
        });
    }
}


// ======================================================================
// Script Modules
// ======================================================================

//This module is used to automatically mass turn eggs for all your friends.
class TurnEggsModule extends OviPostModule {
    constructor() {
        super('TurnEggs', 'Turn Eggs', async () => {
            creditsEarned = 0;
            startTime = Date.now()
            const friends = await this.getFriendList();
            var eggCounter = 0;
            var friendCounter = 0;
            while (friends.length > 0) {
                while (PostQueue.length > 0) {
                    await new Promise(r => setTimeout(r, 50));
                }
                var friend = friends.pop();
                friendCounter++;
                var eggs = await this.getEggs(friend);
                eggCounter += eggs.length;
                setStatus("Turning Eggs (" + friend + ")");
                eggs.forEach(function (egg) {
                    turnEgg(egg, friend);
                });
            }
            setStatus("idle");
            printAllData("oviscript_creditDB", "CreditsFromEggs");
        });
    }

    async getFriendList() {
        var friends = [];
        var ownID = getUserID();
        for (let page = 1; page < 20; page++) {
            const response = await sendGet("src=events&sub=feed&sec=friends&filter=all&Filter=all&page=" + page);
            response.split('usr=').forEach(function (friend) {
                friend = friend.split('&amp').shift().split('\\').shift();
                if (friend.length <= 20 && friend !== ownID && !friends.includes(friend)) {
                    friends.push(friend);
                }
            });
            console.log('page: ' + page + ' friends: ' + friends.length);
            if (response.includes('label = \\\"Previous')) {
                break;
            }
        }

        // Randomize the friends array using Fisher-Yates Shuffle
        for (let i = friends.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [friends[i], friends[j]] = [friends[j], friends[i]];
        }

        return friends;
    }

    async getEggs(userID) {
        console.log("Get Eggs: " + userID);
        const response = await sendGet("src=pets&sub=hatchery&usr=" + userID);
        var eggs = [];
        response.split('Turn Egg').forEach(function (egg) {
            if (!(egg.includes('to avoid') || egg.includes('exectime'))) {
                egg = egg.split('pet=').pop().split('&').shift();
                if (egg.length <= 10) {
                    eggs.push(egg);
                }
            }
        });
        return eggs;
    }
}
const turnEggsModule = new TurnEggsModule();

//This module is used to automatically mass turn eggs for all your friends.
class TurnEggsQuickModule extends OviPostModule {
    constructor() {
        super('TurnEggsQuick', 'Turn Eggs (Quick)', async () => {
            creditsEarned = 0;
            startTime = Date.now()
            const friends = await this.getSortedUserIDs("ovipets_creditDB","CreditsFromEggs");
            var eggCounter = 0;
            var friendCounter = 0;
            while (friends.length > 0) {
                while (PostQueue.length > 0) {
                    await new Promise(r => setTimeout(r, 50));
                }
                var friend = friends.pop();
                friendCounter++;
                var eggs = await this.getEggs(friend);
                eggCounter += eggs.length;
                setStatus("Turning (Q) Eggs (" + friend + ")");
                eggs.forEach(function (egg) {
                    turnEgg(egg, friend);
                });
            }
            setStatus("idle");
            printAllData("oviscript_creditDB", "CreditsFromEggs");
        });
    }

    async getSortedUserIDs(dbName, storeName) {
        return new Promise(async (resolve, reject) => {
          try {
            // Open the IndexedDB database
            const db = await new Promise((resolve, reject) => {
              const request = indexedDB.open(dbName);
              request.onerror = (event) => reject("Error opening database");
              request.onsuccess = (event) => resolve(event.target.result);
            });
      
            // Open a transaction to the store
            const transaction = db.transaction([storeName], "readonly");
            const store = transaction.objectStore(storeName);
      
            // Get all records from the store
            const sortedUserIDs = await new Promise((resolve, reject) => {
              const getAllRequest = store.getAll();
              getAllRequest.onsuccess = (event) => resolve(event.target.result);
              getAllRequest.onerror = (event) => reject("Error getting records from store");
            });
      
            // Sort the records based on credits in descending order
            sortedUserIDs.sort((a, b) => b.credits - a.credits);
      
            // Extract and return only the userIDs
            const userIDs = sortedUserIDs.map((record) => record.userID);
      
            resolve(userIDs);
          } catch (error) {
            reject(error);
          }
        });
      }

    async getEggs(userID) {
        console.log("Get Eggs: " + userID);
        const response = await sendGet("src=pets&sub=hatchery&usr=" + userID);
        var eggs = [];
        response.split('Turn Egg').forEach(function (egg) {
            if (!(egg.includes('to avoid') || egg.includes('exectime'))) {
                egg = egg.split('pet=').pop().split('&').shift();
                if (egg.length <= 10) {
                    eggs.push(egg);
                }
            }
        });
        return eggs;
    }
}
const turnEggsQuickModule = new TurnEggsQuickModule();


class HatchEggsModule extends OviPostModule {
    constructor() {
        super('HatchEggs', 'Hatch Eggs', async () => {
            const eggs = await this.getReadyToHatch();

            eggs.forEach(function (egg) {
                turnEgg(egg);
            });
        });
    }

    async getReadyToHatch() {
        const response = await sendGet("src=pets&sub=hatchery&usr=" + getUserID());

        const eggs = [];
        response.split('Hatch Egg').forEach(function (egg) {
            egg = egg.split('pet=').pop().split('&').shift();
            if (egg.length <= 10) {
                eggs.push(egg);
            }
        });

        return eggs;
    }
}
const hatchEggsModule = new HatchEggsModule();

class MassNameModule extends OviPostModule {
    constructor() {
        super('MassName', 'Mass Name (Selected)', () => {
            var name = prompt("Name:");

            var pets = [];
            if (document.URL.includes('sub=overview')) {
                getSelectedPets().each(function () {
                    var petName = $(this).attr('title');
                    if (petName != name) {
                        pets.push($(this).attr('href').split('pet=').pop());
                    }
                });

                if (pets) {
                    while (pets.length > 0) {
                        setStatus("Renaming Pets");
                        renamePet(pets.shift(), name);
                    }
                    setStatus("idle");
                } else {
                    alert("No pets found.");
                }
            } else if (document.URL.includes('sub=hatchery')) {
                $('img[width=120]').each(function () {
                    pets.push($(this).attr('src').split('pet=').pop().split('&modified').shift());
                });

                if (pets) {
                    while (pets.length > 0) {
                        namePet(pets.shift(), name);
                    }
                } else {
                    alert("No eggs found.");
                }
            }
        });
    }
}
const massNameModule = new MassNameModule();

//Get tatoo data
setInterval(function () {
    var updateButton = $("button:contains('Update'):not(.event-attached)");

    if (updateButton.length > 0) {
        console.log("Found button, attaching event.");
        updateButton.addClass("event-attached");

        updateButton.click(function () {
            var onclickValue = $(this).attr("onclick");
            console.log("Button clicked, onclick value:", onclickValue);

            // Fetch the values directly from the input fields within the 'config' fieldset
            var W = $("fieldset.config div.ui-input.txt input[name='W']").val();
            var H = $("fieldset.config div.ui-input.txt input[name='H']").val();
            var X = $("fieldset.config div.ui-input.txt input[name='X']").val();
            var Y = $("fieldset.config div.ui-input.txt input[name='Y']").val();
            var A = $("fieldset.config div.ui-input.txt input[name='A']").val();

            console.log(`${W},${H},${X},${Y},${A}`);
            alert(`${W},${H},${X},${Y},${A}`);
        });
    }
}, 100);

class MassTattooModule extends OviPostModule {
    constructor() {
        super('MassTattoo', 'Mass Tattoo (Selected)', () => {
            // Create a hidden file input element
            var tattooImage = document.createElement('input');
            tattooImage.type = 'file';
            tattooImage.style.display = 'none';
            tattooImage.id = 'tattooImage';
            document.body.appendChild(tattooImage);

            // Prompt user to select an image
            tattooImage.click();

            tattooImage.onchange = async function () {
                var file = tattooImage.files[0];

                // Checking if file is selected
                if (!file) {
                    alert("Please select an image");
                    return;
                }

                // Read the file as binary string
                var binaryData;
                await new Promise((resolve) => {
                    var reader = new FileReader();
                    reader.onloadend = function () {
                        binaryData = reader.result;
                        resolve();
                    }
                    reader.readAsArrayBuffer(file);
                });

                // Convert binary string to Blob
                var blobData = new Blob([binaryData], { type: file.type });

                var pets = [];
                if (document.URL.includes('sub=overview')) {
                    getSelectedPets().each(function () {
                        pets.push($(this).attr('href').split('pet=').pop());
                    });

                    // Ask user for additional parameters before the pet loop
                    var additionalParams = prompt("Please enter CropW, CropH, CropX, CropY, and Opacity, separated by a comma:");
                    var params = additionalParams.split(',');

                    if (pets) {
                        while (pets.length > 0) {
                            let PetID = pets.shift();

                            PostQueue.push({
                                url: 'https://ovipets.com/cmd.php',
                                body: {
                                    'GeneID': '1',
                                    'Tattoo': blobData,
                                    'cmd': 'tattoo_upl',
                                    'PetID': PetID
                                },
                                meta: 'tattoo_upload'
                            });

                            PostQueue.push({
                                url: 'https://ovipets.com/',
                                body: {
                                    'src': 'pets',
                                    'sub': 'profile',
                                    'sec': 'tattoo,pet',
                                    'pet': PetID,
                                    'Tattoo': 'C%3A%5Cfakepath%5CTattoo.png'
                                },
                                meta: 'tattoo_apply'
                            });

                            // Add additional post request to the queue
                            PostQueue.push({
                                url: 'https://ovipets.com/cmd.php',
                                body: {
                                    'cmd': 'tattoo_upd',
                                    'PetID': PetID,
                                    'GeneID': '1',
                                    'W': params[0],
                                    'H': params[1],
                                    'X': params[2],
                                    'Y': params[3],
                                    'A': params[4]
                                },
                                meta: 'tattoo_edit'
                            });
                        }
                    } else {
                        alert("No pets found.");
                    }
                }

                alert("All uploads queued!");
            }
        });
    }
}
const massTattooModule = new MassTattooModule();

class MassDescModule extends OviPostModule {
    constructor() {
        super('MassDesc', 'Mass Desc (Selected)', () => {
            var text = prompt("Description:");

            var pets = [];
            getSelectedPets().each(function () {
                pets.push($(this).attr('href').split('pet=').pop());
            });

            if (pets) {
                while (pets.length > 0) {
                    addPetDescription(pets.shift(), text);
                }
            } else {
                alert("No pets found.");
            }
        });
    }
}
const massDescModule = new MassDescModule();

class FeedPetsModule extends OviPostModule {
    constructor() {
        super('FeedPets', 'Feed Pets', async () => {
            var count = 0;
            $('li.selected').find('a.pet:not(.name)[href*="pet="]').each(function () {
                var href = $(this).attr('href');
                var PetID = href.split("pet=").pop();
                feedPet(PetID);
                count++;
            });
        });
    }
}
const feedPetsModule = new FeedPetsModule();

class MassBreedModule extends OviPostModule {
    constructor() {
        super('MassBreed', 'Mass Breed', () => {
            function getPetIDs() {
                var petIDs = [];
                $('img[class="pet"]').each(function () {
                    var href = $(this).attr('src');
                    if (href) {
                        petIDs.push(href.split("pet=").pop().split("&modified=").shift());
                    }
                });
                return petIDs;
            }

            function getMaleID() {
                if ($('img[title="Female"]').length > 0) {
                    alert("Error, selected pet is a female. You can only mass breed males.");
                    return null;
                }
                return document.URL.split("pet=").pop();
            }

            var maleID = getMaleID();
            if (!maleID) return;

            var petIDs = getPetIDs();
            if (petIDs) {
                while (petIDs.length > 0) {
                    breedPets(maleID, petIDs.shift());
                }
            } else {
                alert("No pets found to breed with, make sure you have an enclosure selected under the Breeding tab.");
            }
        });
    }
}
const massBreedModule = new MassBreedModule();

class TestModule extends OviPostModule {
    constructor() {
        super('Test', 'Test', () => {
            // Example usage
            // Assume the database name is "creditsDB" and the object store name is "users"
            // Assume the key is the userID and the value is an object with username and credits properties
            // Write some data to the object store
            writeIndexedDB("oviscript_creditDB", "CreditsFromEggs", "user1", { username: "Alice", credits: 100 });
            writeIndexedDB("oviscript_creditDB", "test", "user2", { username: "Bob", credits: 200 });

            // Read some data from the object store
            // Use async/await syntax to handle the promise returned by the read function
            (async function () {
                // Get the username for user1
                let username1 = await readIndexedDB("creditsDB", "test", "user1").then(function (value) {
                    return value.username;
                });
                console.log("Username for user1 is", username1);

                // Get the credits for user2
                let credits2 = await readIndexedDB("creditsDB", "test", "user2").then(function (value) {
                    return value.credits;
                });
                console.log("Credits for user2 are", credits2);
            })();
        });
    }
}

const testModule = new TestModule();

$(document).ready(function () {
    turnEggsModule.render();
    turnEggsQuickModule.render();
    hatchEggsModule.render();
    massNameModule.render();
    massDescModule.render();
    massBreedModule.render();
    feedPetsModule.render();
    massTattooModule.render();
    testModule.render();
});


// ======================================================================
// Post Queue
// ======================================================================
var PostQueue = [];
var successCount = 0; //number of successfull requests
var failedCount = 0; //number of failed requests
let postQueueInterval;

//Sends the server requests and handles API limiting
function startPostQueue() {
    console.log("Starting post queue, delay: " + postDelay);
    postQueueInterval = setInterval(function () {
        if (PostQueue.length > 0) {
            console.log("Sending request");
            var request = PostQueue.shift();
            sendPost(request.url, request.body, request.meta)
                .then(response => handlePostResponse(response, request)); // Pass the request as a parameter
        }
    }, postDelay);
}

function updatePostDelay(newDelay) {
    console.log("Updating post delay: " + postDelay + "->" + newDelay);
    postDelay = newDelay;
    clearInterval(postQueueInterval);
    startPostQueue();
  }

function handlePostResponse(response, request) {
    if (response.meta != null) {
        if (response.res.includes('failed')) {
            if (response.res.includes('The answer is incorrect')) {
                turnCaptchaEgg(request.body.PetID);
            } else {
                failedCount++;
            }
        } else if (response.res.includes('success')) {
            successCount++;
        }
    }
}


//Displays number of request still in queue
function startPostQueueCounter() {
    setInterval(function () {
        if (PostQueue.length == 0) {
            if ($("#postQueue")[0].innerHTML !== "Post Queue: 0") {
                $("#postQueue")[0].innerHTML = "Post Queue: 0";
            }
        }
    }, 1000);
}



// ======================================================================
// Ovipets API
// ======================================================================

class CaptchaSolver {
    constructor(id, species, answer) {
        this.id = id;
        this.species = species;
        this.answer = answer;
    }
}

const captchaCodes = [
    new CaptchaSolver("1696154319", "Canis", 23),
    new CaptchaSolver("1614919856", "Draconis", 3),
    new CaptchaSolver("1696154571", "Equus", 21),
    new CaptchaSolver("1696153656", "Feline", 2),
    new CaptchaSolver("1688169852", "Gekko", 15),
    new CaptchaSolver("1677671012", "Lupus", 6),
    new CaptchaSolver("1682925936", "Mantis", 37),
    new CaptchaSolver("1682925576", "Raptor", 30),
    new CaptchaSolver("1688175088", "Slime", 35),
    new CaptchaSolver("1698842552", "Vulpes", 19)
];

function findCaptchaById(id) {
    return captchaCodes.find((captcha) => captcha.id === id);
}

function setStatus(newStatus) {
    $("#statusText")[0].innerHTML = "Status: " + newStatus;
}

function getUserID() {
    return $($('.links')[0]).find('a')[0].href.split('usr=').pop();
}

// Name unnamed pet
function namePet(PetID, Name) {
    PostQueue.push({
        url: 'https://ovipets.com/cmd.php',
        body: {
            'cmd': 'pet_name',
            'PetID': PetID,
            'Name': Name
        },
        meta: PetID
    });
}

function addEnclosure(Label) {
    PostQueue.push({
        url: 'https://ovipets.com/cmd.php',
        body: {
            'cmd': 'enclosure_add',
            'Presentation': '',
            'Label': Label
        },
        meta: "enclosure_add"
    });
}

// Name named pet
function renamePet(PetID, Name) {
    console.log("renaming: " + PetID + " " + Name);
    PostQueue.push({
        url: 'https://ovipets.com/cmd.php',
        body: {
            'cmd': 'pet_rename',
            'PetID': PetID,
            'Name': Name
        },
        meta: PetID
    });
}

function feedPet(PetID) {
    PostQueue.push({
        url: 'https://ovipets.com/cmd.php',
        body: {
            'cmd': 'pet_feed',
            'PetID': PetID
        },
        meta: "pet_feed"
    });
}

function breedPets(MPetID, FPetID) {
    PostQueue.push({
        url: 'https://ovipets.com/cmd.php',
        body: {
            'cmd': 'pet_breed',
            'MPetID': MPetID,
            'FPetID': FPetID
        },
        meta: 'pet_breed'
    });
}

function addPetDescription(PetID, Text) {
    PostQueue.push({
        url: 'https://ovipets.com/cmd.php',
        body: {
            'cmd': 'pet_presentation',
            'PetID': PetID,
            'Presentation': Text
        },
        meta: 'pet_presentation'
    });
}

// Turn egg or hatch pet
function turnEgg(PetID, meta = null, answer = false) {
    var newElement = {
        url: 'https://ovipets.com/cmd.php',
        body: {
            'cmd': 'pet_turn_egg',
            'PetID': PetID
        },
        meta: meta
    };

    if (answer) {
        newElement.body.Answer = answer;
        PostQueue.unshift(newElement);
    } else {
        PostQueue.push(newElement);
    }
}

async function turnCaptchaEgg(PetID, meta = null) {
    const data = await sendGet("src=pets&sub=profile&pet=" + PetID);
    let json = data.substring(data.indexOf('{'), data.lastIndexOf('}') + 1);
    let userID = getUserIDFromJSON(json);
    var jsonObject = JSON.parse(json);
    var htmlString = jsonObject.output;

    // Find the index where "Solve the following to earn" starts
    let startIndex = htmlString.indexOf("Solve the following to earn");
    let subString;

    // If the phrase is found, create a substring starting from that phrase
    if (startIndex !== -1) {
        subString = htmlString.substring(startIndex);
    } else {
        console.log("Couldn't find 'Solve the following to earn' phrase");
        return;
    }

    // Use regex to find the title attribute with credits
    let creditsRegex = /title\s*=\s*\\'(\d+)\s*Credit/g;
    let creditsMatch = creditsRegex.exec(subString);
    let credits = 0;

    if (creditsMatch && creditsMatch[1]) {
        credits = parseInt(creditsMatch[1]);
        creditsEarned += credits;

        var elapsedTime = (Date.now() - startTime) / 60000;
        var creditsPerMinute = (creditsEarned / elapsedTime).toFixed(2);

        $("#creditsGainedCounter")[0].innerHTML = "Credits Gained: " + creditsEarned + " (" + creditsPerMinute + " c/m)";
    }

    // Use regex to find the img src within the action attribute
    var regex = /img src = \\&quot;(.*?)\\&quot; title = \\&quot;Name the Species/g;
    var match = regex.exec(htmlString);
    var imageUrl;

    if (match && match[1]) {
        imageUrl = match[1].replace(/\\&quot;/g, '"');
    }

    if (imageUrl) {

        // Use regex to find the modified value
        var modifiedRegex = /modified=(\d+)/;
        var modifiedMatch = modifiedRegex.exec(imageUrl);

        if (modifiedMatch && modifiedMatch[1]) {
            let modifiedValue = modifiedMatch[1];

            if (!modifiedValue) {
                console.log("Couldn't find modified value in: " + modifiedMatch);
            }

            const captcha = findCaptchaById(modifiedValue);

            //Show in console if modified value is unknown.
            if (!captcha) {
                console.log("Modified value [" + modifiedValue + "] is not known")
                console.log("Error, URL: " + "https://ovipets.com/#!/?src=pets&sub=profile&pet=" + PetID)
                return;
            }

            let answer = captcha.answer;
            let species = captcha.species

            if (answer && species) {
                console.log('--Question PetID: ' + PetID + ' Species: ' + species + " modifiedID: " + modifiedValue + " Answer Value: " + answer + " Credits: " + credits + " Total Credits Earned: " + creditsEarned);
                addToUserCredits(userID, credits);
                turnEgg(PetID, meta, answer);
            } else {
                alert("Couldn't solve captcha. PetID: " + PetID + " Species: " + species + " answer: " + answer + " modifiedID: " + modifiedValue);
                console.log("--Couldn't solve captcha. PetID: " + PetID + " Species: " + species + " answer: " + answer + " modifiedID: " + modifiedValue);
            }
        }
    } else {
        console.log("Couldn't find question");
    }
}

function sendPetToAdoptionCenter(PetID) {
    PostQueue.push({
        url: 'https://ovipets.com/cmd.php',
        body: {
            'cmd': 'pet_sendto',
            'PetID': PetID,
            'SendTo': 'adoption_center'
        },
        meta: PetID
    });
}

function sendPetToEnclosure(PetID, Enclosure) {
    PostQueue.push({
        url: 'https://ovipets.com/cmd.php',
        body: {
            'cmd': 'pets_enclosure',
            'PetID': PetID,
            'Enclosure': Enclosure
        },
        meta: PetID
    });
}

function tagPet(PetID, TagID, Text) {
    PostQueue.push({
        url: 'https://ovipets.com/cmd.php',
        body: {
            'cmd': 'pets_tag',
            'PetID': PetID,
            'Tag': TagID,
            'Text': Text
        },
        meta: PetID
    });
}

function acceptAllFriendRequests() {
    PostQueue.push({
        url: 'https://ovipets.com/cmd.php',
        body: {
            'cmd': 'friend_requests',
            'Action': 'accept',
            'Filter': 'requests'
        },
        meta: 'accept friend_requests'
    });
}



async function sendPost(url, body, meta = null) {
    $("#postQueue")[0].innerHTML = "Post Queue: " + PostQueue.length;

    const params = new URLSearchParams();
    for (const property in body) {
        params.append(property, body[property]);
    }
    params.append('!jQuery360012094249696657289_1687776334529', ''); // Add specific query parameter

    const fullUrl = url + '?' + params.toString();

    const formData = new FormData();
    for (const property in body) {
        formData.append(property, body[property]);
    }

    const response = await fetch(fullUrl, {
        method: 'POST',
        body: formData,
    });

    const text = await response.text();
    return { 'res': text, 'meta': meta };
}

async function sendGet(params) {

    while ((Date.now() - LastGet) < postDelay) {
        await new Promise(r => setTimeout(r, 50));
    }
    LastGet = Date.now();

    const response = await fetch('https://ovipets.com/?' + params + "&_=1687772471015&!=jQuery360032008126278894555_1687773018994", {
        method: 'GET',
        headers: {
            'Accept': 'text/javascript, application/javascript, application/ecmascript, application/x-ecmascript, */*; q=0.01'
        }
    });

    var responseText = await response.text();
    return responseText;
}

//=====================================================
//  IndexedDB wrapper
//=====================================================

// This function takes a database name, an object store name, a key, and a value as parameters
// It opens the database and creates the object store if it doesn't exist
// It then writes the key-value pair to the object store
async function writeIndexedDB(dbName, storeName, key, value) {
    return new Promise((resolve, reject) => {
      let request = indexedDB.open(dbName);
  
      request.onerror = function (event) {
        console.error("Error opening database:", event.target.errorCode);
        reject(event.target.errorCode);
      };
  
      request.onsuccess = async function (event) {
        let db = event.target.result;
  
        // Check if the database connection is still open
        if (db && db.readyState === "done") {
          // Check if the object store exists, create it if needed
          if (!db.objectStoreNames.contains(storeName)) {
            try {
              let version = db.version + 1;
              db.close();
              let upgradeRequest = indexedDB.open(dbName, version);
              upgradeRequest.onupgradeneeded = function (event) {
                let upgradedDB = event.target.result;
                upgradedDB.createObjectStore(storeName);
              };
              await new Promise((resolve, reject) => {
                upgradeRequest.onsuccess = resolve;
                upgradeRequest.onerror = reject;
              });
            } catch (error) {
              console.error("Error creating object store:", error);
              reject(error);
              return;
            }
          }
  
          // Use an asynchronous function to open a transaction
          let openTransaction = async () => {
            return new Promise((resolve, reject) => {
              let tx;
              try {
                tx = db.transaction(storeName, "readwrite");
              } catch (error) {
                reject(error);
                return;
              }
  
              tx.oncomplete = () => resolve();
              tx.onerror = () => reject(tx.error);
  
              let store = tx.objectStore(storeName);
              store.put(value, key);
            });
          };
  
          // Execute the transaction
          openTransaction()
            .then(() => {
              // Close the database
              db.close();
              resolve();
            })
            .catch((error) => {
              console.error("Error writing to object store:", error);
              reject(error);
            });
        } else {
          console.error("Database connection is closed.");
          reject(new Error("Database connection is closed."));
        }
      };
    });
  }
  
  
  
  
  

// This function takes a database name, an object store name, and a key as parameters
// It opens the database and reads the value for the given key from the object store
// It then returns a promise that resolves with the value or rejects with an error
// This function takes a database name, an object store name, and a key as parameters
// It opens the database and reads the value for the given key from the object store
// It then returns a promise that resolves with the value or rejects with an error
function readIndexedDB(dbName, storeName, key) {
    // Return a new promise
    return new Promise(function(resolve, reject) {
      // Open the database
      let request = indexedDB.open(dbName);
  
      // Handle errors
      request.onerror = function(event) {
        reject(event.target.errorCode);
      };
  
      // Handle success
      request.onsuccess = function(event) {
        // Get the database object
        let db = event.target.result;
  
        // Start a transaction
        let tx = db.transaction(storeName, "readonly");
  
        // Get the object store
        let store = tx.objectStore(storeName);
  
        // Read the value from the object store
        let getRequest = store.get(key);
  
        // Handle errors
        getRequest.onerror = function(event) {
          reject(event.target.errorCode);
        };
  
        // Handle success
        getRequest.onsuccess = function(event) {
          // Get the result
          let result = event.target.result;
  
          // Resolve the promise with the result
          resolve(result);
        };
      };
    });
  }
  
  function addToUserCredits(userID, credits) {
    // Open the database
    let request = indexedDB.open("oviscript_creditDB");
  
    // Handle errors
    request.onerror = function(event) {
      console.error("Error opening database:", event.target.errorCode);
    };
  
    // Handle success
    request.onsuccess = function(event) {
      // Get the database object
      let db = event.target.result;
  
      // Start a transaction
      let tx = db.transaction("CreditsFromEggs", "readwrite");
  
      // Get the object store
      let store = tx.objectStore("CreditsFromEggs");
  
      // Check if the user already exists in the object store
      let getRequest = store.get(userID);
  
      // Handle errors
      getRequest.onerror = function(event) {
        console.error("Error checking user:", event.target.errorCode);
      };
  
      // Handle success
      getRequest.onsuccess = function(event) {
        // Get the result
        let result = event.target.result;
  
        // If the user exists, update the credits
        if (result) {
          // Get the current amount of credits
          let currentCredits = result.credits;
  
          // Add the new amount of credits
          let newCredits = currentCredits + credits;
          console.log("Total Credits gained from: " + userID + " = " + newCredits + " credits")
  
          // Update the record with the new amount of credits
          result.credits = newCredits;
  
          // Write the updated record to the object store
          store.put(result, userID);
        }
        // If the user does not exist, create a new record
        else {
          // Create a new record with the given amount of credits
          let record = {username: userID, credits: credits};
  
          // Write the new record to the object store
          store.put(record, userID);
        }
      };
    };
  
    // Handle database upgrade
    request.onupgradeneeded = function(event) {
      // Get the database object
      let db = event.target.result;
  
      // Create the object store if it doesn't exist
      if (!db.objectStoreNames.contains("CreditsFromEggs")) {
        db.createObjectStore("CreditsFromEggs");
      }
    };
  }

function printAllData(dbName, storeName) {
    // Open the database
    let request = indexedDB.open(dbName);
  
    // Handle errors
    request.onerror = function(event) {
      console.error("Error opening database:", event.target.errorCode);
    };
  
    // Handle success
    request.onsuccess = function(event) {
      // Get the database object
      let db = event.target.result;
  
      // Start a transaction
      let tx = db.transaction(storeName, "readonly");
  
      // Get the object store
      let store = tx.objectStore(storeName);
  
      // Create a cursor to iterate over the records
      let cursor = store.openCursor();
  
      // Handle errors
      cursor.onerror = function(event) {
        console.error("Error reading data:", event.target.errorCode);
      };
  
      // Handle success
      cursor.onsuccess = function(event) {
        // Get the cursor result
        let result = event.target.result;
  
        // If the result is not null, print the record and continue
        if (result) {
          // Get the key and the value of the record
          let key = result.key;
          let value = result.value;
  
          // Print the record as a line to the console
          console.log(key, value);
  
          // Continue to the next record
          result.continue();
        }
        // If the result is null, the iteration is done
        else {
          console.log("All data printed.");
        }
      };
    };
  }

// ======================================================================
// JQuery and Regex (stuff that might change over time..)
// ======================================================================

//Returns a list of PetID's of pets you currently have selected.
function getSelectedPets() {
    return $('li.selected').find('a.pet:not(.name)[href*="pet="]');
}

//Returns a list of PetID's that are currently loaded.
// [WARNING]
//  Every enclosure you open loads the pets to the current session.
//  They will stay loaded during the session, even if you are not currently looking at the enclosure.
//  The only way to unload them is to refresh the page.
//  Best to stay away from using this since it may result into unexpected behaviour.
function getLoadedPetIDs() {
    return $('img[class="pet"]');
}

//Returns the container for the selection buttons that pops up when you select pets
function findSelectNoneButtonContainer() {
    return $('.ui-fieldset-body:visible').find('button:contains("Select None")').closest('.ui-fieldset-body:visible');
}

function getUsernameFromJSON(json) {
    // Define the regex pattern
    let pattern = /\$\(\'title\'\)\.html\(\"(.*?)\s*\|/;
  
    // Test the pattern on the output string
    let match = pattern.exec(json);
  
    // If there is a match, return the first captured group
    if (match) {
      return match[1];
    }
    // If there is no match, return an empty string
    else {
      return "";
    }
  }

  function getUserIDFromJSON(json) {
    // Define the regex pattern
    let pattern = /usr=(\d+)&amp/;
  
    // Test the pattern on the output string
    let match = pattern.exec(json);
  
    // If there is a match, return the first captured group
    if (match) {
      return match[1];
    }
    // If there is no match, return an empty string
    else {
      return "";
    }
  }
  


// ======================================================================
// Front End
// ======================================================================

// Create and append the script menu if it doesn't exist
if (!document.getElementById("scriptMenu")) {
    $("body").append(`
    <div id="gmRightSideBar" style="
        border-radius: 10px;
        border-style: solid;
        border-color: gray;
        border-width: 3px;
        ">
        <ul id="scriptMenu">
          <li><a id="scriptVersion">Version: ` + version + `</a></li>
          <li><a id="statusText">Status: idle</a></li>
          <li><a id="creditsGainedCounter">Credits Gained: 0</a></li>
          <li><a id="postQueue">Post Queue: 0</a></li>
          <li><a>Post Delay:  </a><input type="text" id="inpPostDelay" style="width: 40px;">
          <input type="button" value="Save" id="btnSaveSettings" style="
            width: 50px;
            margin-left: 10px;
      "></li>
        </ul>
    </div>
  `);

  const inputElement = document.getElementById('inpPostDelay');
const btnSaveSettings = document.getElementById('btnSaveSettings');

let inputValue = ""; // Initialize the variable to store the input value

inputElement.addEventListener('input', function() {
    inputValue = inputElement.value.replace(/[^0-9]/g, ''); // Update the inputValue when the input changes
});

btnSaveSettings.addEventListener('click', function() {
    if (inputValue > 10 && inputValue !== "") {
        writeIndexedDB("oviscript", "settings", "postDelay", inputValue);
        updatePostDelay(inputValue);
    }
});

}

function addCustomSelectionOptions() {
    var buttonContainer = findSelectNoneButtonContainer();

    if (buttonContainer.length > 0) {
        // Element found, add the button
        addCustomSelectionButtons();
    } else {
        // Element not found, wait and try again
        setTimeout(addCustomSelectionOptions, 100);
    }
}

function addCustomSelectionButtons() {
    console.log("Adding custom selection buttons");
    var selectNoneButton = $('.ui-input.btn button:contains("Select None")');

    var buttonConfigs = [
        {
            text: "Test",
            handler: function () {
                alert("Test button clicked");
            }
        },
        {
            text: "Hide Bred",
            handler: function () {
                // Your logic to hide bred elements here
            }
        }
        // Add more button configurations as needed
    ];

    // Iterate over the button configurations and create the buttons
    buttonConfigs.forEach(function (config) {
        var button = $('<button>').attr('type', 'button').addClass('ui-button ui-corner-all ui-widget').text(config.text);

        // Insert the button next to the Select None button
        selectNoneButton.after(button);

        // Add click event handler for the button
        button.click(config.handler);
    });
}



// ======================================================================
// Initiator
// ======================================================================

async function startMacro() {
    await loadSettings();

    startPostQueue();

    startPostQueueCounter();

    addCustomSelectionOptions();
}

async function loadSettings() {
    return new Promise(async (resolve, reject) => {
      try {
        // Read the value from the database
        let value = await readIndexedDB("oviscript", "settings", "postDelay");
  
        // If the value exists, set the global variable and resolve the promise
        if (value !== undefined && value !== null) {
          postDelay = value;
  
          // Set the value of the input box with ID 'inpPostDelay'
          document.getElementById('inpPostDelay').value = postDelay;
  
          resolve();
        } else {
          // If the value doesn't exist, write the default value
          await writeIndexedDB("oviscript", "settings", "postDelay", defaultPostDelay);
  
          // Set the global variable to the default value
          postDelay = defaultPostDelay;
  
          // Set the value of the input box with ID 'inpPostDelay'
          document.getElementById('inpPostDelay').value = postDelay;
  
          // Resolve the promise
          resolve();
        }
      } catch (error) {
        // Handle errors, you might want to log or reject the promise
        console.error("Error loading settings:", error);
        reject(error);
      }
    });
  }
  
  

startMacro();
