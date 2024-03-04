//Todo
// 1] Save modified ID, answer and species locally. and in case of an unknown ID let the user do the captcha and remember the answer.
// 4] Move captcha codes list to a separate file
// 7] Change mass name (selected) option to just mass name while on the hatchery page
// 8] Make it so a client can disable module
// 9] Hide the API domain by grabbing the current URL
// 3] module that reads notifications with callbacks. can be used to auto accept friend requests, trade requests, etc


// Modified ID can be used anywhere to check what species a pet is, this may be useful somewhere
// This can also be used to check the state of an egg, the species and how far it is into hatching

const version = "V2.3.2";

let creditDB;
let settingsDB;

var creditsEarned = 0;
var startTime;
var LastGet = Date.now();
var postDelay = 350;

// ======================================================================
// Script Modules
// ======================================================================

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

        // Randomize the friends array
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
            if (!egg.includes('to avoid automatic discard') && !egg.includes('exectime') && !egg.includes('Hatch Egg') && !egg.includes('{"type":"src"')) {
                let valueStart = egg.indexOf("value = '");
                if (valueStart !== -1) {
                    let valueEnd = egg.indexOf("' style =", valueStart);
                    if (valueEnd !== -1) {
                        let eggValue = egg.substring(valueStart + "value = '".length, valueEnd);
                        if (eggValue.length <= 10) {
                            eggs.push(eggValue);
                        }
                    }
                }
            }
        });
        return eggs;
    }
    
}
const turnEggsModule = new TurnEggsModule();

class AutoEggModule extends OviPostModule {
    constructor() {
        super('AutoEggs', 'Auto Eggs', (callback) => {
            this.toggleAutoEgg(callback);
        });

        this.isAutoEggActive = false; // Track the toggle state
        this.intervalId = null; // Track the interval for checking
    }

    toggleAutoEgg(callback) {
        if (this.isAutoEggActive) {
            // If currently active, stop checking and reset button color
            clearInterval(this.intervalId);
            callback();
        } else {
            // If not active, start checking
            this.intervalId = setInterval(() => {
                this.checkAndPressButton(callback);
            }, 10000);
        }

        this.isAutoEggActive = !this.isAutoEggActive;
    }

    async checkAndPressButton() {
        const turnEggsButton = document.getElementById('btnTurnEggs');

        if (turnEggsButton) {
            const backgroundColor = getComputedStyle(turnEggsButton).backgroundColor;

            if (backgroundColor !== 'rgb(0, 255, 0)') {
                // Button is not green, proceed with clicking
                turnEggsButton.click();
            }
        }
    }
}


const autoEggModule = new AutoEggModule();


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
        super('HatchEggs', 'Hatch Eggs', async (callback) => {
            const eggs = await this.getReadyToHatch();

            eggs.forEach(function (egg) {
                turnEgg(egg);
            });

            callback();
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
        super('MassName', 'Mass Name (Selected)', (callback) => {
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
            callback();
        });
    }
}
const massNameModule = new MassNameModule();

//Systematically check page for Tattoo Update button in order to grab Tattoo data
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
        super('MassTattoo', 'Mass Tattoo (Selected)', (callback) => {
            var tattooImage = document.createElement('input');
            tattooImage.type = 'file';
            tattooImage.style.display = 'none';
            tattooImage.id = 'tattooImage';
            document.body.appendChild(tattooImage);

            tattooImage.click();

            tattooImage.onchange = async function () {
                var file = tattooImage.files[0];

                if (!file) {
                    alert("Please select an image");
                    return;
                }

                var binaryData;
                await new Promise((resolve) => {
                    var reader = new FileReader();
                    reader.onloadend = function () {
                        binaryData = reader.result;
                        resolve();
                    }
                    reader.readAsArrayBuffer(file);
                });

                var blobData = new Blob([binaryData], { type: file.type });

                var pets = [];
                if (document.URL.includes('sub=overview')) {
                    getSelectedPets().each(function () {
                        pets.push($(this).attr('href').split('pet=').pop());
                    });

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
            callback();
        });
    }
}
const massTattooModule = new MassTattooModule();

class MassDescModule extends OviPostModule {
    constructor() {
        super('MassDesc', 'Mass Desc (Selected)', (callback) => {
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
            callback();
        });
    }
}
const massDescModule = new MassDescModule();

class FeedPetsModule extends OviPostModule {
    constructor() {
        super('FeedPets', 'Feed Pets', async (callback) => {
            var count = 0;
            $('li.selected').find('a.pet:not(.name)[href*="pet="]').each(function () {
                var href = $(this).attr('href');
                var PetID = href.split("pet=").pop();
                feedPet(PetID);
                count++;
            });
            callback();
        });
    }
}
const feedPetsModule = new FeedPetsModule();

class MassBreedModule extends OviPostModule {
    constructor() {
        super('MassBreed', 'Mass Breed', (callback) => {
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
            callback();
        });
    }
}
const massBreedModule = new MassBreedModule();

class CountPetsModule extends OviPostModule {
    constructor() {
        super('CountPets', 'Count Pets', async (callback) => {
            let enclosure_id = getCurrentEnclosure();
            const petIDs = await this.fetchPets(enclosure_id, getFocusedUserID());
            alert(petIDs.length + " Pets in enclosure: " + enclosure_id);
            callback();
        });
    }

    async fetchPets(enclosure, userId) {
        const baseUrl = 'https://ovipets.com/?';
        const params = {
            src: 'pets',
            sub: 'overview',
            sec: 'pets',
            enclosure: enclosure,
            usr: userId,
            '!': ''
        };

        const queryString = new URLSearchParams(params).toString();
        const url = `${baseUrl}${queryString}`;

        try {
            const response = await fetch(url);

            if (response.ok) {
                const data = await response.json();
                return this.handlePostResponse(data, {body: params});
            } else {
                console.error('Fetch failed', response.status, response.statusText);
                this.displayErrorMessage('Network error or non-OK response status.');
                return [];
            }
        } catch (error) {
            console.error('Error making fetch request:', error);
            this.displayErrorMessage('Error making fetch request.');
            return [];
        }
    }

    handlePostResponse(response, request) {
        if (response.output) {
            try {
                let responseText = response.output;
                const petIdPattern = /PetID\[\]' value = '(\d+)/g;
                let petIds = [...responseText.matchAll(petIdPattern)].map(match => match[1]);
                return petIds;
                
            } catch (e) {
                console.error('Error parsing response:', e);
                this.displayErrorMessage(response.res);
                return [];
            }
        }
        return [];
    }

    displayErrorMessage(message) {
        console.error(message);
    }
}

// Ensure the class instance is correctly named with capitalization
const countPetsModule = new CountPetsModule();




// ======================================================================
// JQuery and Regex (stuff that might change over time..)
// ======================================================================

//Get the ID of the focused enclosure
function getCurrentEnclosure(){
    var activeEnclosureAttribute = $('.ui-tabs-tab.ui-tabs-active.ui-state-active').attr('enclosure');
    var activeEnclosureNumber = activeEnclosureAttribute.match(/\d+/) ? activeEnclosureAttribute.match(/\d+/)[0] : null;
    return activeEnclosureNumber
}

//Get current userID (the userID of the page currently opened, not the account that is logged in so it may grab other people's ID's if you are in their hatchery)
function getFocusedUserID(){
    var href = $('.tabs.left .user.avatar').attr('href');
    var userIdMatch = href.match(/usr=(\d+)/);

    let userId = -1;
    if (userIdMatch && userIdMatch.length > 1) {
        userId = userIdMatch[1];
    }

    return userId
}

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
    let pattern = /\$\(\'title\'\)\.html\(\"(.*?)\s*\|/;

    let match = pattern.exec(json);

    if (match) {
        return match[1];
    }
    else {
        return "";
    }
}

function getUserIDFromJSON(json) {
    let pattern = /usr=(\d+)&amp/;

    let match = pattern.exec(json);

    if (match) {
        return match[1];
    }
    else {
        return "";
    }
}

function getCurrentCredits(){
    const creditsElement = $('a[href="#!/?src=trading"] abbr.credits');

    const creditsTitle = creditsElement.attr('title');

    const credits = parseInt(creditsTitle.replace(/[^0-9]/g, ''), 10);

    return credits;
}

function updateCredits(newCreditCount) {
    const formattedCreditCount = newCreditCount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    const creditsElement = $('abbr.credits').first();
    creditsElement.text('');

    const spanElement = $('<span>').text('Θ');

    creditsElement.append(spanElement);
    creditsElement.append(formattedCreditCount);
    creditsElement.attr('title', formattedCreditCount + ' Credits');
}


//=====================================================
//  Misc Functions
//=====================================================

async function addToUserCredits(userID, credits) {
    try {
        const existingRecord = await creditDB.read(userID);

        if (existingRecord) {
            existingRecord.credits += credits;
            await creditDB.write(userID, existingRecord);
        } else {
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

function displayErrorMessage(message) {
    var maxMessages = 5;
    var messageContainerId = 'error-message-container';
    var messageDuration = 10000; // Duration for each message in ms

    var messageContainer = document.getElementById(messageContainerId);
    if (!messageContainer) {
        messageContainer = document.createElement('div');
        messageContainer.id = messageContainerId;
        messageContainer.style.cssText = 'position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); background-color: rgba(0, 0, 0, 0.7); color: red; text-align: center; padding: 10px; border-radius: 10px; border: 1px solid black; z-index: 1000; font-size: 1.2em; font-weight: bold; overflow: hidden; max-height: 150px; white-space: nowrap; visibility: hidden;';
        document.body.appendChild(messageContainer);
    }

    function updateContainerWidth() {
        messageContainer.style.visibility = 'visible';
        var containerWidth = Array.from(messageContainer.childNodes).reduce((maxWidth, node) => Math.max(maxWidth, node.scrollWidth), 0);
        messageContainer.style.width = `${Math.min(containerWidth, window.innerWidth * 0.8)}px`;
    }

    var newMessageDiv = document.createElement('div');
    newMessageDiv.textContent = message;
    newMessageDiv.style.opacity = 0;
    newMessageDiv.style.transition = 'opacity 0.5s';
    newMessageDiv.style.whiteSpace = 'nowrap';

    messageContainer.appendChild(newMessageDiv);

    updateContainerWidth();

    setTimeout(function() {
        newMessageDiv.style.opacity = 1;
    }, 100);

    setTimeout(function() {
        if (newMessageDiv.parentNode) {
            newMessageDiv.style.opacity = 0;
            setTimeout(function() {
                newMessageDiv.remove();
                updateContainerWidth();
            }, 500);
        }
    }, messageDuration);

    var messages = messageContainer.childNodes;
    if (messages.length > maxMessages) {
        var oldestMessage = messages[0];
        oldestMessage.style.opacity = 0;
        setTimeout(function() {
            oldestMessage.remove();
            updateContainerWidth();
        }, 500);
    }
}

if (!document.getElementById("gmRightSideBar")) {
    $("body").append(`
        <div id="gmRightSideBar" style="
            display: none; /* Initially hide gmRightSideBar */
            border-radius: 10px;
            border-style: solid;
            border-color: gray;
            border-width: 3px;
            position: fixed; /* Make it always accessible */
            right: 0; /* Align to the right side */
            cursor: pointer; /* Change cursor to indicate it's interactive */
        ">
            <ul id="scriptMenu" style="
                list-style-type: none; /* Remove bullet points */
                padding: 0; /* Remove padding */
            ">
                <li><a id="scriptVersion">Version: ` + version + `</a></li>
                <li><a id="statusText">Status: idle</a></li>
                <li><a id="creditsGainedCounter">Credits Gained: 0</a></li>
                <li><a id="postQueue">Post Queue: 0</a></li>
                <li><a>Post Delay: </a><input type="text" id="inpPostDelay" style="width: 40px;">
                <input type="button" value="Save" id="btnSaveSettings" style="
                    width: 50px;
                    margin-left: 10px;
                "></li>
            </ul>
        </div>
    `);

    $(document).mousemove(function(e) {
        if ($(window).width() - e.clientX < 100) {
            $("#gmRightSideBar").fadeIn();
        }
    });

    $("#gmRightSideBar").mouseleave(function() {
        $(this).fadeOut();
    });

    const inputElement = document.getElementById('inpPostDelay');
    const btnSaveSettings = document.getElementById('btnSaveSettings');

    let inputValue = "";

    inputElement.addEventListener('input', function() {
        inputValue = inputElement.value.replace(/[^0-9]/g, '');
    });

    btnSaveSettings.addEventListener('click', async function() {
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
        addCustomSelectionButtons();
    } else {
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
                // To be made.. 
            }
        }
    ];

    buttonConfigs.forEach(function (config) {
        var button = $('<button>').attr('type', 'button').addClass('ui-button ui-corner-all ui-widget').text(config.text);

        selectNoneButton.after(button);

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

            if (value !== undefined && value !== null) {
                postDelay = value;

                document.getElementById('inpPostDelay').value = postDelay;

                resolve();
            } else {
                await settingsDB.write("postDelay", 350);

                postDelay = 350;

                document.getElementById('inpPostDelay').value = postDelay;

                resolve();
            }
        } catch (error) {
            console.error("Error loading settings:", error);
            reject(error);
        }
    });
}

initialize();