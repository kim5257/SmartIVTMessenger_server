$(function (){

    function cvtUTC2Local (date) {
        var now = new Date();
        date.setUTCMinutes(-now.getTimezoneOffset() + date.getMinutes());
        return date;
    }

    function makeLocalTime (timestamp) {
        // 시간대 변환
        var utcDate = new Date(timestamp);
        var localDate = cvtUTC2Local(utcDate);
        var dateString = moment(localDate).format('YYYY-MM-DD HH:mm');

        return dateString;
    }

    function makeSepForm (date) {
        return "<li class=\"media chat-msg-item\">" +
            "<div class=\"media-body\">" +
            "<div class=\"text-center\"><b>" +
            date +
            "</b></div>" +
            "</div>" +
            "</li>";
    }

    function makeMsgForm (owner, fromId, fromEmail, fromName, val, msgNo, timestamp) {
        var id = (msgNo==null)?(''):(' id="msgno_' + msgNo + '"');

        var time = timestamp.slice(11,16);

        if ( owner == false ) {
            return "<li class=\"media chat-msg-item\"" + id + ">" +
                //"<a href='/'>" +
                "<i class=\"align-self-start mr-3 fa fa-user fa-2x\" data-fa-transform=\"flip-h\"></i>" +
                //"</a>" +
                "<div class=\"media-body\">" +
                "<div class=\"d-flex justify-content-between\">" +
                "<h6 class=\"mt-0\">" + fromName + "  <small>(" + fromEmail + ")</small></h6>" +
                "</div>" +
                "<div class=\"chat-msg-box\">" +
                "<p class=\"chat-msg-body\">" + val + "</p>" +
                "</div>" +
                "<small>&nbsp&nbsp" + time + "</small>" +
                "</div>" +
                "</li>";
        }
        else {
            return "<li class=\"media chat-msg-item-owner align-bottom\"" + id + ">" +
                "<div class=\"media-body align-bottom\">" +
                "<div class=\"m-1\" style=\"float: right;\">" +
                "<small class=\"align-bottom\" >" + time + "&nbsp&nbsp</small>" +
                "<div class=\"chat-msg-box-myself align-bottom\">" +
                "<p class=\"chat-msg-body\">" + val + "</p>" +
                "</div>" +
                "</div>" +
                "</div>" +
                "</li>";
        }

        return ret;
    }

    var sock = io();

    // 처음 실행하면 방에 들어감
    var pktJoin = {
        room_num: data.room_info['room_num']
    };

    var pktReqLog = {
        room_num: data.room_info['room_num'],
        from: data.user_info['user_id'],
        to: ['all', data.user_info['user_id']],
        limit: 20,
        offset: 0,
    };

    if ( data.user_info['role'] === 'mgr' ) {
        pktReqLog.to.push('mgr');
    }

    sock.on('reconnect', function(){
        console.log('reconnect');

        // 다시 방 들어가기 처리 수행
        sock.emit('join_room', pktJoin);
    });

    sock.on('error', function(msg){
        console.log('error: ' + msg);

        window.location.href = "/login";
    });

    var firstDate = null;
    var lastestDate = null;

    sock.on('chat_msg', function(msg){
        console.log(JSON.stringify(msg));
        msg.val = msg.val.replace(/\n/g, '<br>');

        //var timeString = msg.timestamp.substring(0, msg.timestamp.length-3);

        var localTime = makeLocalTime(msg.timestamp);
        var date = localTime.slice(0, 10);

        if ( lastestDate != null )
        {
            if ( lastestDate != date )
            {
                // 날짜가 다르면 구분자 추가
                $('#msg_list').append(makeSepForm(date));
            }
        }
        lastestDate = date;

        if ( data.user_info['user_id'] != msg.from ) {
            $('#msg_list').append(makeMsgForm(false, msg.from, msg.from_email, msg.from_name, msg.val, null, localTime));
            window.scrollTo(0, document.body.scrollHeight);
        }
        else {
            $('#msg_list').append(makeMsgForm(true, msg.from, msg.from_email, msg.from_name, msg.val, null, localTime));
            window.scrollTo(0, document.body.scrollHeight);
        }
    });

    sock.on('res_msg_log', function(res){
        console.log('res_msg_log: ' + JSON.stringify(res));

        if ( res.result==='success' && res.messages.length != 0 )
        {
            var extraMsgForm = '';

            res.messages.forEach((item) => {
                //var timeString = item.timestamp.substring(0, item.timestamp.length-3);
                item.message = item.message.replace(/\n/g, '<br>');

                var localTime = makeLocalTime(item.timestamp);
                var date = localTime.slice(0, 10);

                // 최초 불러오는거면 최근 날짜 저장
                if ( lastestDate == null )
                {
                    lastestDate = date;
                }

                if ( firstDate != null )
                {
                    if ( firstDate != date )
                    {
                        // 날짜가 다르면 구분자 추가
                        extraMsgForm = makeSepForm(date) + extraMsgForm;
                    }
                }
                firstDate = date;


                if ( data.user_info['user_id'] != item['from'] ){
                    extraMsgForm = makeMsgForm ( false, item.from, item.email, item.from_name, item.message, item['msg_no'], localTime) + extraMsgForm;
                    //$('#msg_list').prepend(makeMsgForm(false, item.from_name, item.message, item['msg_no'], timeString));
                }
                else {
                    extraMsgForm = makeMsgForm(true, item.from, item.email, item.from_name, item.message, item['msg_no'], localTime) + extraMsgForm;
                    //$('#msg_list').prepend(makeMsgForm(true, item.from_name, item.message, item['msg_no'], timeString));
                }
            });

            $('#msg_list').prepend(extraMsgForm);

            if ( pktReqLog.offset == 0 ) {
                window.scrollTo(0, document.body.scrollHeight);
            }
            else
            {
                var offset = $('#msgno_' + pktReqLog.offset).offset();
                console.log(offset.top - 50);
                window.scrollTo(0, offset.top - 50);
            }

            // 마지막 읽은 위치 갱신
            pktReqLog.offset = res.messages[res.messages.length-1]['msg_no'];

            console.log('Height: ' + document.body.scrollHeight);
        }
    });

    sock.on('req_except_user', function(msg) {
        console.log('excepted ' + msg['user_id']);

        var userItemId = '#userItem-' + msg['user_id'];

        // 사용자 제거
        $(userItemId).remove();
    });

    sock.emit('join_room', pktJoin);
    sock.emit('req_msg_log', pktReqLog);

    $('#send-msg').keydown(function(event) {
        if ( (event.ctrlKey === true) &&
            (event.keyCode === 13) ) {
            // Ctrl+Enter
            $(this).trigger('submit');
        }
    });

    $('#send-msg').submit(function(){
        console.log(data.user_info.role);

        console.log($('#msg').val());

        if ( $('#msg').val() != '' ) {
            var msg = {
                room_num: data.room_info['room_num'],
                pack: {
                    from: data.user_info['user_id'],
                    from_name: data.user_info['user_name'],
                    from_email: data.user_info['email'],
                    to: (data.user_info['role'] === 'mgr') ? ('all') : ('mgr'),
                    val: $('#msg').val()
                }
            }

            sock.emit('chat_msg', msg);
            $('#msg').val('');
        }

        return false;
    });

    function uploadFile(formData) {

        var url = '/room/' + data.room_info['room_num'] + '/upload';

        console.log(url);

        $.ajax({
            url: url,
            method: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            xhr: function() {
                var xhr = new XMLHttpRequest();

                xhr.upload.addEventListener('progress', function(event) {
                    var progressBar = $('.progress-bar');

                    if ( event.lengthComputable ) {
                        var percent = (event.loaded / event.total) * 100;
                        progressBar.width(percent + '%');

                        if ( percent === 100 )
                        {
                            progressBar.removeClass('active');
                        }
                    }
                });

                return xhr;
            }
        }).done(handleSuccess).fail(function(xhr, status) {
            alert(status);
        });
    }

    function handleSuccess(data) {
        // Do nothing at now
    }

    $('#send-img').submit(function(event){

        event.preventDefault();

        var file = $('#input-file').get(0).files[0];
        var formData = new FormData();

        formData.append('photos[]', file, file.name);

        uploadFile(formData);
    });

    $(window).scroll(function() {
        if ( (document.documentElement.scrollTop == 0) &&
            (document.body.scrollTop == 0) )
        {
            console.log('Request Message Log');
            // 추가 기록 요청
            sock.emit('req_msg_log', pktReqLog);
        }
    });

    $(window).resize(function() {
        console.log('resize: ' + window.outerHeight);
        window.scrollTo(0, document.body.scrollHeight);
    });

    $('.del-user').click(function() {
        console.log('clicked ' + $(this).val());

        var msg = {
            room_num: data.room_info['room_num'],
            user_id: $(this).val()
        }

        sock.emit('req_except_user', msg);
    });

    $('#input-file').change(function(event) {

        var filePath = URL.createObjectURL(event.target.files[0]);

        $('#img').attr('src', filePath);
    });
});


