console.log("Ovi Script Loaded");

const version = "1.0.53";

let creditDB;
let settingsDB;

var creditsEarned = 0;
var startTime;
var LastGet = Date.now();
var postDelay = 350;

// ======================================================================
// Script Modules
// ======================================================================

//This module is used to automatically mass turn eggs for all your friends.
class TurnEggsModule extends OviPostModule {
    constructor() {
        super('TurnEggs', 'Turn Eggs', (callback) => {
            this.turnEggs(callback);
        });
    }

    async turnEggs(callback) {
        creditsEarned = 0;
        startTime = Date.now();
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
        // Call the callback to reset the button's background color
        callback();
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
        super('TurnEggsQuick', 'Turn Eggs (Quick)', (callback) => {
            creditsEarned = 0;
            startTime = Date.now();
            this.turnEggs(callback);
        });
    }

    async turnEggs(callback) {
        const friends = await this.getSortedUserIDs();
        console.log(friends);
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
        // Call the callback to reset the button's background color
        callback();
    }

    async getSortedUserIDs() {
        const creditThreshold = 10;
        try {
            if (!creditDB.db) {
                await creditDB.openDatabase();
            }

            const objectStore = creditDB.db.transaction([creditDB.storeName], "readonly").objectStore(creditDB.storeName);

            const userIDs = await new Promise((resolve, reject) => {
                const getAllKeysRequest = objectStore.getAllKeys();
                getAllKeysRequest.onsuccess = (event) => resolve(event.target.result);
                getAllKeysRequest.onerror = (event) => reject("Error getting keys from store");
            });

            const fetchCreditsPromises = userIDs.map(async (userID) => ({
                userID,
                credits: (await creditDB.read(userID)).credits
            }));

            try {
                const sortedUserIDs = await Promise.all(fetchCreditsPromises);

                // Filter out users with credits less than creditThreshold
                const filteredUserIDs = sortedUserIDs.filter(({ credits }) => credits > creditThreshold);

                // Sort by credits in descending order
                filteredUserIDs.sort((a, b) => b.credits - a.credits);

                // Resolve with sorted user IDs
                return filteredUserIDs.map(({ userID }) => userID);
            } catch (error) {
                // Reject if any of the promises fail
                console.error("Error fetching credits:", error);
                throw error;
            }
        } catch (error) {
            console.error("Error in getSortedUserIDs:", error);
            throw error;
        }
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

$(document).ready(function () {
    turnEggsModule.render();
    turnEggsQuickModule.render();
    hatchEggsModule.render();
    massNameModule.render();
    massDescModule.render();
    massBreedModule.render();
    feedPetsModule.render();
    massTattooModule.render();
});

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

//Get the number of credits displayed on the page
function getCurrentCredits(){
    // Use the jQuery selector to find the abbr element with the class 'credits'
    const creditsElement = $('a[href="#!/?src=trading"] abbr.credits');

    // Extract the title attribute, which contains the credit count
    const creditsTitle = creditsElement.attr('title');

    // Parse the credit count from the title attribute
    const credits = parseInt(creditsTitle.replace(/[^0-9]/g, ''), 10);

    return credits;
}

//Update number of credits displayed on the page
function updateCredits(newCreditCount) {
    // Format the credit count with a comma for thousands separation
    const formattedCreditCount = newCreditCount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    const creditsElement = $('abbr.credits');
    creditsElement.text('');

    const spanElement = $('<span>').text('Θ');

    creditsElement.append(spanElement);
    creditsElement.append(formattedCreditCount);
    creditsElement.attr('title', formattedCreditCount + ' Credits');
}

//=====================================================
//  Misc Functions
//=====================================================

// Usage in addToUserCredits
async function addToUserCredits(userID, credits) {
    try {
        const existingRecord = await creditDB.read(userID);

        if (existingRecord) {
            // If the user exists, update the credits
            existingRecord.credits += credits;
            await creditDB.write(userID, existingRecord);
        } else {
            // If the user does not exist, create a new record
            const record = { userID: userID, credits: credits };
            await creditDB.write(userID, record);
        }
    } catch (error) {
        console.error("Error adding credits:", error);
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

    inputElement.addEventListener('input', function () {
        inputValue = inputElement.value.replace(/[^0-9]/g, ''); // Update the inputValue when the input changes
    });

    btnSaveSettings.addEventListener('click', async function () {
        if (inputValue > 10 && inputValue !== "") {
            try {
                await settingsDB.write("postDelay", parseInt(inputValue, 10));
                updatePostDelay(inputValue);
            } catch (error) {
                console.error("Error saving post delay to database:", error);
            }
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

async function initialize() {
    await startMacro();
}

async function startMacro() {

    try {
        creditDB = new DatabaseHandler("oviscript_creditDB", "CreditsFromEggs");
        settingsDB = new DatabaseHandler("oviscript", "settings");

        await loadSettings(settingsDB);

        startPostQueue();

        startPostQueueCounter();

        addCustomSelectionOptions();
    } catch (error) {
        console.error("Error in startMacro:", error);
    }
}

async function loadSettings(settingsDB) {
    return new Promise(async (resolve, reject) => {
        try {
            let value = await settingsDB.read("postDelay");

            // If the value exists, set the global variable and resolve the promise
            if (value !== undefined && value !== null) {
                postDelay = value;

                // Set the value of the input box with ID 'inpPostDelay'
                document.getElementById('inpPostDelay').value = postDelay;

                resolve();
            } else {
                // If the value doesn't exist, write the default value
                await settingsDB.write("postDelay", 350);

                // Set the default value
                postDelay = 350;

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

initialize();
