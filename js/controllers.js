bananaSplit.controller('BananaSplitMainCtrl', function( $sce, $rootScope, $scope, BananaSplit, $routeParams, $location ) {

	if ( $rootScope.currentDirectory === undefined ) {
		$rootScope.currentDirectory = '/';
	}

	if ( $rootScope.queue === undefined ) {
		$rootScope.queue = [];
	}

	$scope.queueVisible = false;

	$scope.toggleQueue = function() {
		$('body, #queue').toggleClass('slide');
	}	

	$scope.browseDirectory = function() {

		BananaSplit.browseDirectory($rootScope.currentDirectory).then(function(response) {

			//console.log( response.data );

			$rootScope.directoryList = {};
			$rootScope.directoryList.directory = response.data.directory;
			$rootScope.directoryList.files = [];

			response.data.files.forEach(function(file) {
				if ( file.name.indexOf('.') != 0 ) {
					$rootScope.directoryList.files.push(file);
				}

				if ( file.name == '..' ) {
					$rootScope.directoryList.parentDirectory = file;
				}
			});

		});
	}

	$scope.openFile = function( file ) {
		$rootScope.currentVideo = file;
		$location.path('/split');
	}

	$scope.$watch('currentDirectory', function() {
		//console.log($rootScope.directoryList);
		$scope.browseDirectory();
	});

})

.controller('BananaSplitSplitCtrl', function( $sce, $rootScope, $scope, BananaSplit, $routeParams ) {

	$scope.console = ['Running video through ffmpeg\'s black frame detection...'];

	$scope.gap = 2;

	$scope.currentSplit = 0;
	$scope.currentTime = '100%';
	$scope.splits = [];
	$scope.segments = [];

	$scope.thumbnail = function(gapModifier) {
		if ( $scope.blackdetect != undefined ) {
			var imgUrl = 'video.php?function=thumbnail';
			    imgUrl += '&time=' + ($scope.blackdetect[$scope.currentSplit].black_middle + ($scope.gap * gapModifier));
			    imgUrl += '&f=' + encodeURIComponent($rootScope.currentVideo.path);
			return imgUrl;
		}
	}

	$scope.setCurrentTime = function() {
		$scope.currentTime = ( $scope.blackdetect[$scope.currentSplit].black_middle / $scope.duration.in_seconds ) * 100;
		$scope.currentTime = $scope.currentTime + "%";
	}

	$scope.nextSplit = function() {
		//console.log('next');
		if ( $scope.currentSplit != $scope.blackdetect.length - 1 ) {
			$scope.currentSplit = $scope.currentSplit + 1;
			$scope.setCurrentTime();
		}
	}

	$scope.prevSplit = function() {
		//console.log('prev');
		if ( $scope.currentSplit != 0 ) {
			$scope.currentSplit = $scope.currentSplit - 1;
			$scope.setCurrentTime();
		}
	}

	$scope.gotoSplit = function(index) {
		$scope.currentSplit = index;
		$scope.setCurrentTime();
	}

	$scope.addSplit = function() {
		$scope.splits.push($scope.blackdetect[$scope.currentSplit].black_end);
		//console.log($scope.splits);
		$scope.createSegments();
	}

	$scope.removeSplit = function(splitindex) {
		$scope.splits.splice(splitindex, 1);
		$scope.createSegments();
	}

	$scope.createSegments = function() {
		$scope.segments = [];

		if ( $scope.splits.length > 0 ) {
			var keyframes = [];
			keyframes[0] = 0;
			keyframes = keyframes.concat($scope.splits);
			keyframes.push($scope.duration.in_seconds);

			for ( var i = 0; i < keyframes.length - 1; i++ ) {
				var currentSegment = {
					start: keyframes[i],
					end: keyframes[i + 1],
					encoding: false
				}

				$scope.segments.push(currentSegment);
			}

			//console.log($scope.segments);
		}
	}

	$scope.addSegmentToQueue = function(segment, index) {
		segment.name = $rootScope.currentVideo.name;
		segment.path = $rootScope.currentVideo.path;
		segment.status = 'pending';
		$rootScope.queue.push(segment);

		$scope.segments[index].inQueue = true;
	}

	BananaSplit.detectSplits($rootScope.currentVideo.path).then(function(response) {

		$scope.console = response.data.ffmpeg_output;
		$scope.blackdetect = response.data.blackdetect;
		$scope.duration = response.data.duration;

		$scope.blackdetect.forEach(function(black) {
			black.black_start = parseFloat(black.black_start);
			black.black_end = parseFloat(black.black_end);
			black.black_duration = parseFloat(black.black_duration);

			black.black_middle = black.black_start + (black.black_duration / 2);
		});

		$scope.setCurrentTime();

		//console.log($scope.blackdetect);

	});

})

.controller('BananaSplitQueueCtrl', function( $sce, $rootScope, $scope, BananaSplit, $routeParams ) {

	$scope.removeFromQueue = function(index) {
		$rootScope.queue.splice(index, 1);
	}

	$scope.startQueue = function() {
		$scope.currentQueueIndex = 0;

		$rootScope.queue.forEach(function(segment) {
			if (segment.status != 'pending') {
				$scope.currentQueueIndex++;
			}
		});

		$rootScope.encodingSegment = $rootScope.queue[$scope.currentQueueIndex];
		$scope.segmentVideo();
	}

	$scope.segmentVideo = function() {
		$rootScope.encodingSegment.status = 'encoding';
		BananaSplit.splitVideo($rootScope.encodingSegment).then(function(response) {
			$rootScope.encodingSegment.status = 'complete';
			//console.log(response);
			//console.log(segment);
			if ( $scope.currentQueueIndex + 1 < $rootScope.queue.length ) {
				$scope.currentQueueIndex++;
				$rootScope.encodingSegment = $rootScope.queue[$scope.currentQueueIndex];
				$scope.segmentVideo();
			}
		});
	}

});