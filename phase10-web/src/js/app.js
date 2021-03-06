$(document).ready(function(){
    window.ac = -1;
    $("#handblock").sortable({
        update: update_hand_arrangement
    });
});

function syncJSON(i_url, callback) {
  $.ajax({
    type: "GET",
    async: false,
    url: i_url,
    contentType: "application/json",
    dataType: "json",
    success: function (msg) { callback(msg) },
    error: function (msg) { alert('error : ' + msg.d); }
  });
}

function new_game(){
    $.getJSON("api/new_game", function(data){
        window.game_id = data["return"];
        join_game(data["return"]);
    });
}

function rejoin_game(){
    window.player_id = $("#player_id").val();
    window.game_id = $("#game_id").val();
    $("#landing").css("display", "none");
    $("#game").css("display", "block");
    $.getJSON("api/game_info/"+game_id, function(data){
        $('#game_title').text(data['title']);
        $('#ac').val(0);
    })
    window.drawn = false;
    window.dealt = false;
    setInterval(listener_loop, 1000);
}

function join_game(game_id){
    $("#landing").css("display", "none");
    $("#game").css("display", "block");
    if (typeof game_id === "undefined"){
        window.game_id = $("#game_id").val();
        game_id = $("#game_id").val();
    }
    $.getJSON("api/join/"+window.game_id, function(data){
        window.player_id = data["return"];
    });
    $.getJSON("api/game_info/"+game_id, function(data){
        $('#game_title').text(data['title']);
        $('#ac').val(0);
    })
    window.drawn = false;
    window.dealt = false;
    setInterval(listener_loop, 1000);
}

function listener_loop() {
    $.getJSON("api/ac/"+window.game_id, function(data){
        if(data["return"] > window.ac){
            window.ac = data["return"];
            full_update();
            message("Status: GOOD");
        }
    })
    unlock();
}

function full_update(){
    update_game_info();
    update_phases();
    update_players();
    update_hand();
    update_decks();
    update_buttons();
}

function update_game_info(){
    console.log("game info update");
    syncJSON("api/game_info/" + window.game_id, function(data){
        window.turn = data['turn'];
        window.round = data['round'];
        window.dealer = data['dealer'];
        window.title = data['title'];
    });
    syncJSON("api/players/" + window.game_id, function(data){
        window.phase = data["return"][window.player_id]["phase"];
        window.down = data["return"][window.player_id]["down"];
    });
}


function update_players(){
    $.getJSON("api/players/" + window.game_id, function(data){
        console.log("player update");
        $("#playerbar").html("");
        $("#playerbar").text("");
        window.players = 0;
        for(var pl in data["return"]){
            window.players += 1;
            var ct = Handlebars.compile($("#player_template").html());
            $("#playerbar").html($("#playerbar").html()+ct(data["return"][pl]));
        }
        $("#player_info"+window.player_id).css("font-weight","bold");
        $("[id^=dealer]").css("display","none");
        $("#dealer"+window.dealer).css("display","inline-block");
        $("[id^=turn]").css("display","none");
        $("#turn"+window.turn).css("display","inline-block");
    });
}

function update_phases(){
    $("#phaseblock").html("");
    $("#phaseblock").text("");
    $.getJSON("api/phases/" + window.game_id, function(data){
        console.log("phase update");
        var cw = Handlebars.compile($("#pilecontainer_template").html());
        var cc = Handlebars.compile($("#pilecard_template").html());
        for(var pile in data){
            var content = "";
            for(var card in data[pile]){
                console.log(data[pile][card]);
                content+=cc(data[pile][card]);
            }
            $("#phaseblock").html($("#phaseblock").html()+cw({'content':content, 'id':pile}));
        }
    });
}

function update_hand(){
    window.dealt = false;
    $.getJSON("api/hand/" + window.game_id + "/" + window.player_id, function(data){
        console.log("hand update");
        $("#handblock").html("");
        $("#handblock").text("");
        var prefix = "hand_";
        var id_arr = [];
        if([1,2,3,7,9,10].indexOf(window.phase) > -1){
            prefix = "alt_";
        }
        
        if(data["return"].length == 0){
            // This solves the bug of the previous round not ending with a discard
            // This control flow is taken at the start of a round before being dealt
            window.drawn = false;
        }
        
        for(var card in data["return"]){
            window.dealt = true;
            var ct = Handlebars.compile($("#"+prefix+"card_template").html());
            $("#handblock").html($("#handblock").html()+ct(data["return"][card]));
            id_arr.push(data["return"][card].card_id);
        }
        for(var card in $("#handblock").children()){
            $("#handblock").children()[card].card_id = id_arr[card];
        }
        if(window.dealt){
            $("#dealbutton").css("display","none");
        }else{
            $("#dealbutton").css("display","inline");
        }

    });
}

function update_hand_arrangement(){
    console.log("rearrange hand silently. listen for successfull callback otherwise, update_hand. no ac increment.")
    var order = [];
    var cards = $("input[id^=handcard]");
    for(var card=0;card<cards.length;card++){
        order.push(cards[card].id.replace("handcard",""));
    }
    $.getJSON("api/rearrange/"+window.game_id+"/"+window.player_id+"/"+order.join('-'), function(data){
        if(data["return"]!="GOOD"){
            update_hand()
        }
    });

}

function sort_hand(){
    console.log("rearrange hand silently. listen for successfull callback otherwise, update_hand. no ac increment.")
    var order = [];
    var cards = $("input[id^=handcard]");
    for(var card=0;card<cards.length;card++){
        order.push(parseInt(cards[card].id.replace("handcard","")));
    }
    order.sort(function(a,b){return a>b});
    
    $.getJSON("api/rearrange/"+window.game_id+"/"+window.player_id+"/"+order.join('-'), function(data){
        update_hand()
    });
}

function update_buttons(){
    if(window.turn == window.player_id){
        $("#buttonblock").css("display","inline");
        $("input").css("display","inline");
    }else{
        $("#buttonblock").css("display","none");
        $("input").css("display","none");
    }
}

function update_decks(){
    $.getJSON("api/top_discard/"+window.game_id, function(data){
        console.log("deck update");
        $("#mainblock").html("");
        $("#mainblock").text("");
        var ct = Handlebars.compile($("#deck_card_template").html());
        var bct = Handlebars.compile($("#blank_card_template").html());
        var cd = "";
        if (data["card_id"] >= 0){
            if(data["card_id"] <= 3){
                data["card_id"] = "skip";
            }else{
                data["card_id"] = "disc";
            }
            cd = ct(data);
        }else{
            cd = bct({});
        }

        $("#mainblock").html(cd + ct({"offset":"20","value":"?","color":"grey","card_id":"main"}))
    });
}

function deal_round(){
    if(checklock()){return;}
    if(window.dealer == window.player_id){
        $.getJSON("api/deal/" + window.game_id, function(data){
            console.log("deal");
        });
    }
    setlock();
}

function draw(){
    if(checklock()){return;}
    if(window.drawn){
        message("Already drew a card");
        return;
    }
    if(!window.dealt){
        message("Have not been dealt to yet");
        return;
    }
    console.log("draw");
    var checked = $("input[id^=deckcard]:checked");
    if(checked.length!=1){
        message("Bad card selection");
        return;
    }
    var card = checked[0].id.replace('deckcard','');
    if(card == "skip"){
        message("Cannot Draw a Skip");
        return;
    }
    if(card=="main"){
        $.getJSON("api/draw_main/"+window.game_id);
    }else if(card=="disc"){
        $.getJSON("api/draw_discard/"+window.game_id);
    }else{
        message("Bad card selection");
        return;
    }
    window.drawn=true;
    setlock();
}

function discard(){
    if(checklock()){return;}
    if(!window.drawn){
        message("Haven't drawn a card yet");
        return;
    }
    console.log("discard");
    var checked = $("input[id^=handcard]:checked");
    if(checked.length!=1){
        message("Bad card selection");
        return;
    }
    var card = checked[0].id.replace('handcard','');
    $.getJSON("api/discard/"+window.game_id+"/"+card);
    window.drawn = false;
    setlock();
}

function hit(){
    if(checklock()){return;}
    if(!window.down){
        message("Not down yet! don't do that");
        return;
    }
    console.log("hit");
    var pile = $("input[id^=pile]:checked");
    var card = $("input[id^=handcard]:checked");
    
    if(pile.length!=1 || card.length!=1){
        message("Bad card selection");
        return;
    }
    var pile_str = pile[0].id.replace('pile','').split("-")
    var pile_id = pile_str[0]
    var side = pile_str[1]
    var card_id = card[0].id.replace('handcard','')

    $.getJSON("api/hit/"+window.game_id+"/"+card_id+"/"+pile_id+"/"+side)
    
    setlock();
}

function lay_down(){
    if(checklock()){return;}
    console.log("lay_down");
    var card_set_1 = "";
    var card_set_2 = "";
    var q1 = $("input[id^=handcard]:checked");
    var q2 = $("input[id^=altcard]:checked");
    for(var x=0; x<q1.length;x++){
        card_set_1 += q1[x].id.replace('handcard','') + '-';
    }
    for(var x=0; x<q2.length;x++){
        card_set_2 += q2[x].id.replace('altcard','') + '-';
    }
    $.getJSON("api/down/"+window.game_id+"/"+card_set_1+"_"+card_set_2);
    setlock();
}

function skip(){
    if(checklock()){return;}
    console.log("skip");
    var checked_player = $("input[id^=player]:checked");
    var checked_card = $("input[id^=handcard]:checked");
    if(checked_player.length!=1 || checked_card.length!=1){
        message("Bad card selection");
        return;
    }
    if(!window.drawn){
        // Don't want people discarding skip before drawn
        message("Haven't drawn a card yet");
        return;
    }
    var pid = checked_player[0].id.replace('player','');
    var cid = checked_card[0].id.replace('handcard','');
    $.getJSON("api/skip/"+window.game_id+"/"+pid, function(data){
        console.log(data)
        discard();
    });
}

function setlock(){
    window.lock = true;
}

function checklock(){
    return window.lock;
}

function unlock(){
    window.lock = false;
}

function message(msg){
    $("#messagearea").text(msg);
}
